#!/usr/bin/env python3
"""
Cloudgate workflow deployer for the POS controller.

Every action (workflow API) lives under cloudgate/workflows/<route>/ as a
workflow.json plus one file per node script. This script compiles those into
the Cloudgate endpoint JSON and pushes it through the workflow MCP
(JSON-RPC over streamable HTTP), then publishes.

    python cloudgate/deploy.py                 # deploy every workflow
    python cloudgate/deploy.py catalog cart    # deploy selected routes
    python cloudgate/deploy.py --list          # show tenant actions
    python cloudgate/deploy.py --no-publish    # leave as draft

Auth: reuses the OAuth token the Claude Code Cloudgate plugin caches in
~/.mcp-auth (mcp-remote). Override with CLOUDGATE_MCP_URL / CLOUDGATE_MCP_TOKEN.

workflow.json shape:
{
  "name": "Catalog", "route": "catalog", "method": "POST",
  "allowAnonymous": false, "enableLogging": true,
  "entry": "IdpAuth",
  "nodes": [
    { "name": "IdpAuth", "type": "idp", "output": "userId|userInfo", "allowAnonymous": true, "role": "Admin", "permission": "orders.view", "next": "Plan" },
    { "name": "Plan",  "type": "function", "script": "plan.py",  "next": "Run" },
    { "name": "Run",   "type": "database", "script": "run.sql",  "next": "Shape" },
    { "name": "Guard", "type": "condition", "script": "guard.py", "positive": "Plan", "negative": "Deny" },
    { "name": "Pay",   "type": "walletpayment", "params": { "operation": "create", "amount": "${Total}", "reference": "${Ref}" }, "next": "Save" },
    { "name": "Shape", "type": "function", "script": "shape.py" }
  ]
}
"""
import glob
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
WORKFLOWS_DIR = os.path.join(HERE, "workflows")
CONFIG_PATH = os.path.join(HERE, "deploy.config.json")

NODE_MARKET = {
    "function": ("c81329ef-5713-49ef-a634-80bf728472ad", 1),
    "request": ("e653b811-6fe1-49fc-881d-e80f688984df", 2),
    "decision": ("f23f5979-1a01-4bf3-9761-e29365dd450f", 3),
    "condition": ("85782a05-66c7-40b9-b0db-854638827318", 4),
    "database": ("072f563b-7186-4b0b-a463-b905d944e957", 5),
    "idp": ("9cc226c5-c784-4138-950e-dd85bb4d97be", 9),
    # WebSocket publish: {"type": "websocket", "channel": "<name in deploy.config.json websockets>", "body": "${NotifyBody}"}
    "websocket": ("82b0e256-006a-44f1-8923-38a05ae69f71", 8),
    # Wallet Payment (Cloudgate branch feature/shop-platform): Param1 operation, Param2..10 inputs.
    "walletpayment": ("7a2c4f1e-9b3d-4c8a-9e21-5d6f0b8a3c11", 11),
}
WALLET_PARAMS = {
    "operation": "Param1", "amount": "Param2", "currency": "Param3", "description": "Param4",
    "reference": "Param5", "customerEmail": "Param6", "successUrl": "Param7", "cancelUrl": "Param8",
    "idempotencyKey": "Param9", "paymentId": "Param10",
}
REQUEST_TYPE = {"ANY": 0, "GET": 1, "POST": 2, "PUT": 3, "DELETE": 4}
HTTP_METHOD = {"GET": 0, "POST": 1, "PUT": 2, "DELETE": 3}
IDP_OUTPUT = {"userId": 1, "userInfo": 2, "tokenInfo": 3}
SCHEDULE_CRON = {
    "Once": -1, "TwoMinutes": 0, "FiveMinutes": 1, "TenMinutes": 2, "ThirtyMinutes": 3, "Hourly": 4,
    "Daily": 5, "Weekly": 6, "Monthly": 7, "Hourly4": 41, "Hourly6": 42, "Hourly12": 43,
}


# ----------------------------------------------------------------------------- MCP client
class Mcp:
    OAUTH_CLIENT_ID = "cloudgate-mcp"  # the static client the Claude Code plugin registers

    def __init__(self, url, token, token_file=None, refresh_token=None):
        self.url = url
        self.token = token
        self.token_file = token_file
        self.refresh_token = refresh_token
        self._id = 0

    @staticmethod
    def from_env():
        url = os.environ.get("CLOUDGATE_MCP_URL", "http://localhost:44301/mcp/workflow")
        token = os.environ.get("CLOUDGATE_MCP_TOKEN")
        if token:
            return Mcp(url, token)
        home = os.path.expanduser("~")
        files = sorted(glob.glob(os.path.join(home, ".mcp-auth", "mcp-remote-v1", "*_tokens.json")),
                       key=os.path.getmtime, reverse=True)
        if not files:
            sys.exit("No cached MCP token found. Run any Cloudgate command in Claude Code first, "
                     "or set CLOUDGATE_MCP_TOKEN.")
        data = json.load(open(files[0], encoding="utf-8"))
        return Mcp(url, data["access_token"], token_file=files[0], refresh_token=data.get("refresh_token"))

    def _refresh(self):
        """Access tokens live an hour; swap the cached refresh token for a new pair and persist it
        in mcp-remote's file so the Claude Code plugin keeps working with the rotated token."""
        if not self.refresh_token:
            return False
        origin = self.url.split("/mcp/")[0]
        try:
            meta = json.load(urllib.request.urlopen(f"{origin}/.well-known/oauth-authorization-server", timeout=15))
            token_endpoint = meta.get("token_endpoint") or f"{origin}/connect/token"
        except Exception:
            token_endpoint = f"{origin}/connect/token"
        form = urllib.parse.urlencode({
            "grant_type": "refresh_token", "refresh_token": self.refresh_token, "client_id": self.OAUTH_CLIENT_ID,
        }).encode("utf-8")
        try:
            with urllib.request.urlopen(urllib.request.Request(
                    token_endpoint, data=form, headers={"Content-Type": "application/x-www-form-urlencoded"}), timeout=30) as r:
                fresh = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"  token refresh failed: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:200]}")
            return False
        self.token = fresh["access_token"]
        self.refresh_token = fresh.get("refresh_token", self.refresh_token)
        if self.token_file:
            try:
                data = json.load(open(self.token_file, encoding="utf-8"))
                data.update({k: v for k, v in fresh.items() if k in ("access_token", "refresh_token", "expires_in", "token_type", "scope")})
                if "expires_in" in fresh:
                    data["expires_at"] = int(time.time()) + int(fresh["expires_in"])
                with open(self.token_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
            except Exception as ex:
                print(f"  (could not persist refreshed token: {ex})")
        return True

    def call(self, tool, arguments, _retried=False):
        self._id += 1
        payload = {"jsonrpc": "2.0", "id": self._id, "method": "tools/call",
                   "params": {"name": tool, "arguments": arguments}}
        req = urllib.request.Request(
            self.url, data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json",
                     "Accept": "application/json, text/event-stream"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                text = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code == 401:
                if not _retried and self._refresh():
                    return self.call(tool, arguments, _retried=True)
                sys.exit("MCP token rejected (401) and refresh failed. Run any Cloudgate command in Claude Code "
                         "to sign in again, or set CLOUDGATE_MCP_TOKEN.")
            raise RuntimeError(f"MCP HTTP {e.code}: {body[:500]}")
        if "data:" in text[:300]:
            lines = [ln[5:].strip() for ln in text.splitlines() if ln.startswith("data:")]
            text = lines[-1]
        msg = json.loads(text)
        if "error" in msg:
            raise RuntimeError(f"{tool}: {msg['error']}")
        result = msg["result"]
        if result.get("isError"):
            raise RuntimeError(f"{tool}: {json.dumps(result)[:800]}")
        content = result.get("content") or []
        texts = [c.get("text", "") for c in content if c.get("type") == "text"]
        joined = "\n".join(texts)
        try:
            return json.loads(joined)
        except ValueError:
            return joined


# ----------------------------------------------------------------------------- compile
def load_config():
    if not os.path.exists(CONFIG_PATH):
        sys.exit(f"Missing {CONFIG_PATH}. Create it with projectId, projectPath, databases.")
    return json.load(open(CONFIG_PATH, encoding="utf-8"))


SHARED_LIB = os.path.join(WORKFLOWS_DIR, "_shared", "lib.py")


def read_script(folder, name, with_lib=False, libraries=None):
    path = os.path.join(folder, name)
    with open(path, encoding="utf-8") as f:
        text = f.read().replace("\r\n", "\n")
    if with_lib and os.path.exists(SHARED_LIB):
        # Every Function/Condition script runs standalone inside Cloudgate's `def main():`
        # wrapper, so the shared helpers are inlined at deploy time rather than imported.
        with open(SHARED_LIB, encoding="utf-8") as f:
            lib = f.read().replace("\r\n", "\n")
        text = lib.rstrip("\n") + "\n\n# ---- node script ----\n" + text
    if libraries:
        sources = []
        for library in libraries:
            with open(os.path.join(folder, library), encoding="utf-8") as f:
                sources.append(f.read().replace("\r\n", "\n"))
        text = "\n".join(sources) + "\n" + text
    return text


def base_node(name, kind, endpoint_id, x, y):
    market, node_type = NODE_MARKET[kind]
    return {
        "Name": name, "MainScript": None, "DebugBreakpointsJson": None,
        "Param1": None, "Param2": None, "Param3": None, "Param4": None, "Param5": None,
        "Param6": None, "Param7": None, "Param8": None, "Param9": None, "Param10": None,
        "Url": None, "HttpMethod": None, "Body": None, "Headers": [], "Queries": [], "Forms": [],
        "ForwardRequestHeaders": False, "ForwardFormData": False, "ForwardParams": False,
        "RichText": None, "Decisions": [], "PositiveNodeId": None, "NegativeNodeId": None,
        "Link": None, "ImageId": None, "NodeType": node_type, "NodeMarketId": market,
        "NodeId": None, "ThreadEntryNodeId": None, "EndpointId": endpoint_id,
        "Width": 200, "Height": 220, "X": float(x), "Y": float(y), "Text": None, "Border": None,
        "ParentId": None, "FileId": None, "FileProdId": None, "ScheduleEndpointId": None,
        "ScheduleCron": None, "ScheduleState": None, "ExpireInMinutes": None, "StartOfDay": None,
        "DayOfWeek": None, "DayOfMonth": None, "StopOnError": False, "SelectorName": None,
        "SelectorIsGlobal": None, "SelectorType": None, "WebSocketId": None, "WebSocketName": None,
        "IdpOuputType": None, "IdpAuthorizeAllowAnonymous": False, "IdpUsersSkip": None,
        "IdpUsersTake": None, "IdpUsersFilter": None, "Id": str(uuid.uuid4()),
    }


def compile_workflow(folder, config, endpoint_id=None):
    spec = json.load(open(os.path.join(folder, "workflow.json"), encoding="utf-8"))
    endpoint_id = endpoint_id or str(uuid.uuid4())
    names = [n["name"] for n in spec["nodes"]]
    if len(set(names)) != len(names):
        raise ValueError(f"{spec['route']}: duplicate node names")

    nodes = []
    by_name = {}
    for i, n in enumerate(spec["nodes"]):
        kind = n["type"]
        node = base_node(n["name"], kind, endpoint_id, 240 + 340 * i, (i % 2) * 260 if n.get("stagger") else 0)
        if kind in ("function", "condition"):
            node["MainScript"] = read_script(folder, n["script"], with_lib=not n.get("noLib"), libraries=n.get("libraries"))
        if kind == "database":
            node["MainScript"] = read_script(folder, n["script"])
        if kind == "database":
            db = config["databases"][n.get("database", "default")]
            node["FileId"] = db["fileId"]
            node["FileProdId"] = db.get("fileProdId", db["fileId"])
        if kind == "idp":
            node["IdpOuputType"] = IDP_OUTPUT[n.get("output", "userId")]
            node["IdpAuthorizeAllowAnonymous"] = bool(n.get("allowAnonymous", False))
            # Optional gate for signed-in callers (Cloudgate branch feature/shop-platform): a role name
            # (User/Contributor/Admin or a tenant role; omit = any valid token) and/or a permission key
            # the caller's role must grant. Anonymous callers are governed by allowAnonymous alone.
            node["IdpAuthorizeRole"] = str(n.get("role") or "")
            node["IdpAuthorizePermission"] = str(n.get("permission") or "")
        if kind == "websocket":
            channel = config.get("websockets", {}).get(n["channel"])
            if not channel:
                raise ValueError(f"{spec['route']}/{n['name']}: websocket channel '{n['channel']}' missing from deploy.config.json")
            node["WebSocketId"] = channel["id"]
            node["WebSocketName"] = channel.get("name", n["channel"])
            node["Body"] = n.get("body", "")
        if kind == "walletpayment":
            unknown = set(n.get("params", {})) - set(WALLET_PARAMS)
            if unknown:
                raise ValueError(f"{spec['route']}/{n['name']}: unknown wallet params {sorted(unknown)}")
            for key, slot in WALLET_PARAMS.items():
                value = n.get("params", {}).get(key)
                node[slot] = str(value) if value is not None else None
            node["Param1"] = node["Param1"] or "create"
        if kind == "request":
            node["Url"] = n["url"]
            node["HttpMethod"] = HTTP_METHOD[n.get("httpMethod", "POST").upper()]
            node["Body"] = read_script(folder, n["body"]) if n.get("body") else None
            node["Headers"] = [{"Key": k, "Value": v, "Enabled": True} for k, v in (n.get("headers") or {}).items()]
            node["Queries"] = [{"Key": k, "Value": v, "Enabled": True} for k, v in (n.get("queries") or {}).items()]
        nodes.append(node)
        by_name[n["name"]] = node

    for n, node in zip(spec["nodes"], nodes):
        if n.get("next"):
            node["NodeId"] = by_name[n["next"]]["Id"]
        if n.get("positive"):
            node["PositiveNodeId"] = by_name[n["positive"]]["Id"]
        if n.get("negative"):
            node["NegativeNodeId"] = by_name[n["negative"]]["Id"]
        if n.get("thread"):
            # Async branch: Cloudgate enqueues a background job that runs from this node with the
            # request's session keys, after the main chain has moved on (e.g. send a receipt).
            node["ThreadEntryNodeId"] = by_name[n["thread"]]["Id"]

    # Optional schedule: {"cron": "FiveMinutes", "sandbox": true, "production": false}
    schedule = spec.get("schedule") or {}
    cron = SCHEDULE_CRON[schedule["cron"]] if schedule.get("cron") else None

    endpoint = {
        "Name": spec["name"], "Route": spec["route"], "UseBasicAuthentication": False,
        "Username": "", "Password": "", "EndpointType": 0,
        "RequestType": REQUEST_TYPE[spec.get("method", "POST").upper()],
        "RunOnSchedule": cron is not None, "ScheduleCron": cron,
        "ScheduledSandbox": bool(schedule.get("sandbox", True)) if cron is not None else False,
        "ScheduledProduction": bool(schedule.get("production", False)) if cron is not None else False,
        "EnableRequestLimit": False, "Daily": None, "Weekly": None,
        "Monthly": None, "X": None, "Y": None, "AllowAnonymous": bool(spec.get("allowAnonymous", False)),
        "EnableLogging": bool(spec.get("enableLogging", True)), "IsAsync": False, "EnableCache": False,
        "CacheInMinutes": None, "IsActive": True, "IsPrivate": False, "MaskData": False,
        "NodeId": by_name[spec["entry"]]["Id"], "ProjectId": config["projectId"], "Id": endpoint_id,
    }
    return spec, {"projectId": config["projectId"], "Endpoint": endpoint, "Nodes": nodes}


# ----------------------------------------------------------------------------- deploy
def deploy(mcp, config, folder, publish=True):
    spec, _ = compile_workflow(folder, config)
    existing = {e["Route"].lower(): e for e in mcp.call("list_endpoints", {"project_id": config["projectId"]})}
    current = existing.get(spec["route"].lower())

    if current is None:
        _, payload = compile_workflow(folder, config)
        valid = mcp.call("validate_workflow_json", {"endpoint_json": json.dumps(payload)})
        if isinstance(valid, dict) and valid.get("valid") is False:
            raise RuntimeError(f"{spec['route']}: invalid workflow JSON: {valid.get('errors')}")
        created = mcp.call("create_endpoint", {"endpoint_json": json.dumps(payload), "dry_run": False})
        endpoint_id = (created.get("Id") or created.get("id") or created.get("endpointId")) if isinstance(created, dict) else None
        if not endpoint_id:
            existing = {e["Route"].lower(): e for e in mcp.call("list_endpoints", {"project_id": config["projectId"]})}
            endpoint_id = existing[spec["route"].lower()]["Id"]
        print(f"  created  /{config['projectPath']}/{spec['route']}  ({endpoint_id})")
    else:
        endpoint_id = current["Id"]
        state = mcp.call("get_workflow_edit_state", {"endpoint_id": endpoint_id})
        if isinstance(state, dict) and not state.get("canMutateWorkflow", state.get("editState", {}).get("canMutateWorkflow")):
            mcp.call("begin_workflow_edit", {"endpoint_id": endpoint_id})
        _, payload = compile_workflow(folder, config, endpoint_id=endpoint_id)
        valid = mcp.call("validate_workflow_json", {"endpoint_json": json.dumps(payload)})
        if isinstance(valid, dict) and valid.get("valid") is False:
            raise RuntimeError(f"{spec['route']}: invalid workflow JSON: {valid.get('errors')}")
        mcp.call("update_endpoint", {"endpoint_json": json.dumps(payload), "dry_run": False})
        print(f"  updated  /{config['projectPath']}/{spec['route']}  ({endpoint_id})")

    if publish:
        mcp.call("publish_endpoint", {"endpoint_id": endpoint_id, "dry_run": False, "confirm_apply": True})
        print(f"  published /{config['projectPath']}/{spec['route']}")
        verify_links(mcp, endpoint_id, spec["route"])
    return endpoint_id


def verify_links(mcp, endpoint_id, route):
    """Read the graph back and make sure every next/positive/negative/thread link resolves to a node.
    The server regenerates node ids on every create/update; a link that survives with a stale id is
    silently dead at runtime (a thread branch job that 'succeeds' without running, for example)."""
    graph = mcp.call("get_workflow_graph", {"endpoint_id": endpoint_id, "include_scripts": False})
    if isinstance(graph, str):
        try:
            graph = json.loads(graph)
        except ValueError:
            return
    nodes = (graph or {}).get("Nodes") or (graph or {}).get("nodes") or []
    ids = {n.get("Id") or n.get("id") for n in nodes}
    bad = []
    for n in nodes:
        for link in ("NodeId", "PositiveNodeId", "NegativeNodeId", "ThreadEntryNodeId"):
            target = n.get(link) or n.get(link[0].lower() + link[1:])
            if target and target not in ids:
                bad.append(f"{n.get('Name') or n.get('name')}.{link} -> {target}")
    if bad:
        raise RuntimeError(f"{route}: published graph has dangling links (host needs the thread-link fix?): {bad}")


def main(argv):
    publish = "--no-publish" not in argv
    routes = [a for a in argv if not a.startswith("--")]
    config = load_config()
    mcp = Mcp.from_env()

    if "--list" in argv:
        for e in mcp.call("list_endpoints", {"project_id": config["projectId"]}):
            print(f"  {e['Route']:<20} {e['Name']:<28} draft={e.get('IsDraft')}  {e['Id']}")
        return

    folders = sorted(d for d in glob.glob(os.path.join(WORKFLOWS_DIR, "*"))
                     if os.path.isdir(d) and not os.path.basename(d).startswith("_"))
    if routes:
        folders = [f for f in folders if os.path.basename(f) in routes]
        missing = set(routes) - {os.path.basename(f) for f in folders}
        if missing:
            sys.exit(f"Unknown workflow folder(s): {', '.join(sorted(missing))}")

    print(f"Deploying {len(folders)} workflow(s) to controller '{config['projectPath']}' ({config['projectId']})")
    for folder in folders:
        started = time.time()
        try:
            deploy(mcp, config, folder, publish=publish)
        except Exception as ex:  # keep going, report at the end
            print(f"  FAILED   {os.path.basename(folder)}: {ex}")
            continue
        print(f"           {time.time() - started:.1f}s")


if __name__ == "__main__":
    main(sys.argv[1:])

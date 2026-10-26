"""Package standard Python scripts with ordinary workflow selector inputs."""
import re

def bind_inputs(source):
    names={'body','Snapshot','Run','IdpAuth'}
    names.update(re.findall(r"(?:value|obj|snapshot|payment_request_value)\(\s*['\"]([A-Za-z_][A-Za-z_0-9]*)['\"]",source))
    # Selectors are bound as data by the existing workflow runtime. Python only
    # receives strings; it never resolves host services or invokes a bridge.
    inputs=', '.join(repr(name)+': '+repr('${'+name+'}') for name in sorted(names))
    return '_inputs = {'+inputs+'}\n'+source

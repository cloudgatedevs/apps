"""Rebuild email App Store workflows offline; never publish or send email."""
from package_refunds import main
if __name__ == "__main__":
    main(['admin-settings', 'pos-receipt'])

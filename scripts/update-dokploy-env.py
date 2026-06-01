"""One-shot: fetch current Dokploy env for TwinMCP app, patch in the new
STRIPE_PROMO_YOUTUBER_ID and corrected STRIPE_PRO_MONTHLY_PRICE_ID, then
trigger a redeploy. Idempotent: re-running won't duplicate the new key.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

TOKEN = os.environ["DOKPLOY_TOKEN"]
APP_ID = "JqHTb_9ysJe0MLepXp6ZQ"
BASE = "https://admin.twinmcp.fr/api/trpc"
NEW_MONTHLY = "price_1StyDb4KyaVjON379VVS32fR"
NEW_PROMO = "promo_1Tddhl4KyaVjON37342bdZuJ"


def req(path, method="GET", body=None):
    url = f"{BASE}/{path}"
    headers = {"x-api-key": TOKEN, "Content-Type": "application/json"}
    if body is not None:
        data = json.dumps({"json": body}).encode()
        r = urllib.request.Request(url, data=data, headers=headers, method=method)
    else:
        r = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


# 1) GET current app
qs = urllib.parse.quote(json.dumps({"json": {"applicationId": APP_ID}}))
status, data = req(f"application.one?input={qs}")
assert status == 200, f"fetch failed: {status} {data}"
app = data["result"]["data"]["json"]
env = app["env"]
print(f"current env: {len(env)} chars")

# 2) Patch env in-place
# Replace STRIPE_PRO_MONTHLY_PRICE_ID value (regardless of quoting)
new_env, n_monthly = re.subn(
    r'^(STRIPE_PRO_MONTHLY_PRICE_ID)\s*=.*$',
    rf'\1="{NEW_MONTHLY}"',
    env,
    flags=re.MULTILINE,
)
print(f"STRIPE_PRO_MONTHLY_PRICE_ID replacements: {n_monthly}")

# Upsert STRIPE_PROMO_YOUTUBER_ID — replace if present, append if not
if re.search(r'^STRIPE_PROMO_YOUTUBER_ID\s*=', new_env, flags=re.MULTILINE):
    new_env, n_promo = re.subn(
        r'^(STRIPE_PROMO_YOUTUBER_ID)\s*=.*$',
        rf'\1="{NEW_PROMO}"',
        new_env,
        flags=re.MULTILINE,
    )
    print(f"STRIPE_PROMO_YOUTUBER_ID replaced ({n_promo})")
else:
    suffix = "\n# Collab YouTuber promo (added via update-dokploy-env.py)\n"
    suffix += f'STRIPE_PROMO_YOUTUBER_ID="{NEW_PROMO}"\n'
    new_env = new_env.rstrip() + suffix
    print("STRIPE_PROMO_YOUTUBER_ID appended")

print(f"new env: {len(new_env)} chars")

# 3) POST update — try saveEnvironment first, fall back to update
payload = {"applicationId": APP_ID, "env": new_env}
status, resp = req("application.saveEnvironment", method="POST", body=payload)
if status != 200:
    print(f"saveEnvironment failed ({status}): {resp}")
    print("falling back to application.update")
    status, resp = req("application.update", method="POST", body=payload)
print(f"update status: {status}")
if status != 200:
    print(json.dumps(resp, indent=2)[:600])
    sys.exit(1)

# 4) Redeploy
status, resp = req("application.deploy", method="POST", body={"applicationId": APP_ID})
print(f"deploy trigger status: {status}")
if status != 200:
    print(json.dumps(resp, indent=2)[:600])

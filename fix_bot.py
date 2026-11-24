import os
import json
import urllib.request

KEY = os.environ.get("GROQ_KEY", "")
PATH = "app/page.tsx"

print("Loomi Bot starting...")

try:
    with open(PATH, "r", encoding="utf-8") as f:
        code = f.read()
except:
    print("No page.tsx found")
    code = ""

prompt = "You are a Next.js fixer. Fix all build errors in this page.tsx. Return ONLY full fixed code, no explanation, no markdown, no backticks. Keep it working, keep age gate, login, feed, dashboard. Code: " + code[:8000]

data = {
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": prompt}],
    "max_tokens": 7000,
    "temperature": 0.1
}

req = urllib.request.Request(
    "https://api.groq.com/openai/v1/chat/completions",
    data=json.dumps(data).encode("utf-8"),
    headers={
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json"
    }
)

try:
    with urllib.request.urlopen(req, timeout=60) as res:
        out = json.loads(res.read().decode("utf-8"))
        fixed = out["choices"][0]["message"]["content"]
        fixed = fixed.replace("```tsx", "").replace("```", "").strip()
        with open(PATH, "w", encoding="utf-8") as f:
            f.write(fixed)
        print("Fixed and saved!")
except Exception as e:
    print("Fix failed:")
    print(str(e))

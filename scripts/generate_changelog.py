#!/usr/bin/env python3
import subprocess

def get_latest_tag():
    tags = subprocess.run(["git","tag"], capture_output=True, text=True).stdout.split()
    return tags[-1] if tags else None

def get_commits(since):
    rev = f"{since}..HEAD" if since else "HEAD"
    return subprocess.run(
        ["git","log", rev, "--pretty=format:* %s (%an)"],
        capture_output=True, text=True
    ).stdout

def main():
    tag = get_latest_tag()
    entries = get_commits(tag).strip()
    header = f"# Changelog since {tag or 'start'}\n\n"
    with open("CHANGELOG.md", "w") as f:
        f.write(header + (entries + "\n" if entries else "No changes\n"))

if __name__ == "__main__":
    main()

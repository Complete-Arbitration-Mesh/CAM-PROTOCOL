#!/usr/bin/env python3
import subprocess

def get_latest_tag():
    tags = subprocess.check_output(["git", "tag"], text=True).split()
    return tags[-1] if tags else None

def get_commits(since_tag):
    if since_tag:
        rev = f"{since_tag}..HEAD"
    else:
        rev = "HEAD"
    out = subprocess.check_output(
        ["git", "log", rev, "--pretty=format:* %s (%an)"], text=True
    )
    return out.strip()

def main():
    tag = get_latest_tag()
    commits = get_commits(tag)
    with open("CHANGELOG.md", "w") as f:
        header = f"# Changelog since {tag or 'start'}\n\n"
        f.write(header)
        f.write(commits + "\n")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Tell Me More - Daily Check-in Script
Runs at 6 PM to report progress, risks, and decisions
"""

import os
import re
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path("/Users/pjames/NAS-Dev/openclaw/workspace/tell-me-more")
OUTPUT_FILE = Path("/Users/pjames/NAS-Dev/openclaw/workspace/tell-me-more/daily_report.md")


def parse_roadmap():
    """Extract current phase and progress from ROADMAP.md"""
    roadmap_file = PROJECT_DIR / "ROADMAP.md"
    if not roadmap_file.exists():
        return "No roadmap found"
    
    content = roadmap_file.read_text()
    
    # Find current phase
    phases = []
    for match in re.finditer(r'## Phase (\d): (.+?) \(Weeks (\d+)-(\d+)\)', content):
        phases.append({
            'num': match.group(1),
            'name': match.group(2),
            'weeks': f"Weeks {match.group(3)}-{match.group(4)}",
            'start': match.start()
        })
    
    # Find completed items (checked boxes)
    completed = re.findall(r'- \[x\] (.+)', content)
    pending = re.findall(r'- \[ \] (.+)', content)
    
    return {
        'phases': phases,
        'completed': completed,
        'pending': pending
    }


def parse_engineering_review():
    """Extract action items and concerns from ENGINEERING_REVIEW.md"""
    review_file = PROJECT_DIR / "ENGINEERING_REVIEW.md"
    if not review_file.exists():
        return {}
    
    content = review_file.read_text()
    
    # Extract action items
    action_items = re.findall(r'- \[ \] (.+)', content)
    
    # Extract concerns by severity
    high_severity = re.findall(r'\| (\d+\.\d+) \|.+?\| High \| (.+?) \|', content)
    medium_severity = re.findall(r'\| (\d+\.\d+) \|.+?\| Medium \| (.+?) \|', content)
    
    # Extract module status
    module_status = re.findall(r'### (.+?) Module (.+)', content)
    
    return {
        'action_items': action_items,
        'high_severity': high_severity,
        'medium_severity': medium_severity,
        'module_status': module_status
    }


def get_file_stats():
    """Get last modified dates for key files"""
    files = [
        "PROJECT_PLAN.md",
        "ROADMAP.md", 
        "ARCHITECTURE.md",
        "ENGINEERING_REVIEW.md",
        "MODULE_DESIGNS.md",
        "DEPLOYMENT.md",
        "REQUIREMENTS.md",
        "TOOLING.md"
    ]
    
    stats = {}
    for f in files:
        path = PROJECT_DIR / f
        if path.exists():
            mtime = datetime.fromtimestamp(path.stat().st_mtime)
            stats[f] = mtime.strftime("%b %d")
    
    return stats


def generate_report():
    """Generate the daily check-in report"""
    
    # Get current date
    today = datetime.now().strftime("%A, %b %d")
    
    # Parse data
    roadmap = parse_roadmap()
    review = parse_engineering_review()
    stats = get_file_stats()
    
    # Build report
    report = f"""# 🎙️ TELL ME MORE | {today}

## 📊 Project Status

**Mission:** Personalized podcast playlist app - users follow topics, get relevant episodes

**Current Phase:** Phase 1 (Foundation) - Not Started
**Target:** MVP in 8 weeks

---

## ✅ What's Done

"""
    
    # Add completed items
    if roadmap.get('completed'):
        for item in roadmap['completed'][:10]:
            report += f"- {item}\n"
    else:
        report += "- No items marked complete yet\n"
    
    report += """

## 🎯 This Week's Focus

| Phase | Task | Status |
|-------|------|--------|
| 1 | Initialize Next.js project | ⏳ Not Started |
| 1 | Set up PostgreSQL + Prisma | ⏳ Not Started |
| 1 | Implement Auth | ⏳ Not Started |

---

## 🚨 Risks & Concerns

"""
    
    # Add high severity concerns
    if review.get('high_severity'):
        for item_id, concern in review['high_severity']:
            report += f"- **{item_id}**: {concern}\n"
    else:
        report += "- No high-severity concerns\n"
    
    report += """

## 🤔 Decisions Needed

"""
    
    # Extract key decisions from review
    decisions = [
        "Tech stack finalization (Next.js vs alternative)",
        "Database schema approval",
        "CI/CD pipeline configuration",
        "Deployment environment setup",
        "Whisper transcription approach (CPU vs GPU)"
    ]
    
    for i, decision in enumerate(decisions, 1):
        report += f"{i}. {decision}\n"
    
    report += f"""

---

## 📁 Project Files

| File | Last Updated |
|------|--------------|
"""
    
    for file, date in stats.items():
        report += f"| {file} | {date} |\n"
    
    report += """

## 🔜 Next Steps

1. **Initialize project** - Set up Next.js repo
2. **Finalize architecture** - Sign off on designs
3. **Start Phase 1** - Begin Foundation work

---

*Report generated: {}*
""".format(datetime.now().strftime("%Y-%m-%d %I:%M %p"))
    
    return report


def main():
    report = generate_report()
    
    # Save to file
    OUTPUT_FILE.write_text(report)
    
    # Print to stdout for Telegram
    print(report)


if __name__ == "__main__":
    main()

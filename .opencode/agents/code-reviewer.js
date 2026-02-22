#!/usr/bin/env node
/**
 * Code Review Agent
 * 
 * Conducts pre-commit code reviews, identifies bad practices,
 * and creates beads issues for problems found.
 * 
 * Usage: node code-reviewer.js [--staged] [--diff-only] [--fix]
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { glob } from "glob";
import path from "path";

// Review configuration
const REVIEW_RULES = {
  // TypeScript / Type Safety
  typeSafety: {
    name: "Type Safety",
    checks: [
      {
        pattern: /:\s*any\b(?!\s*\[)/g,
        severity: "critical",
        message: "`any` type detected - use proper types instead",
        fixable: false,
      },
      {
        pattern: /as\s+unknown\s+as/g,
        severity: "critical", 
        message: "Unsafe `as unknown as` cast - use proper typing",
        fixable: false,
      },
      {
        pattern: /!\s*$/gm,
        severity: "warning",
        message: "Non-null assertion - add proper null checks",
        fixable: false,
      },
    ],
  },
  
  // Code Quality
  codeQuality: {
    name: "Code Quality",
    checks: [
      {
        pattern: /console\.(log|warn|error|debug)\s*\(/g,
        severity: "warning",
        message: "Console statement - remove or use proper logging",
        fixable: true,
      },
      {
        pattern: /TODO|FIXME|XXX|HACK/g,
        severity: "info",
        message: "Code marker found - create beads issue instead",
        fixable: false,
      },
      {
        pattern: /if\s*\([^)]+\)\s*\{[\s\S]*?if\s*\([^)]+\)\s*\{[\s\S]*?if\s*\(/g,
        severity: "warning",
        message: "Deep nesting (3+ levels) - consider early returns",
        fixable: false,
      },
    ],
  },
  
  // React Best Practices
  react: {
    name: "React Best Practices",
    checks: [
      {
        pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[\s*\]/g,
        severity: "warning",
        message: "useEffect with empty deps - add proper dependencies",
        fixable: false,
      },
      {
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?useState\s*\(/g,
        severity: "info",
        message: "Consider extracting component logic to custom hook",
        fixable: false,
      },
    ],
  },
  
  // Performance
  performance: {
    name: "Performance",
    checks: [
      {
        pattern: /\.reduce\s*\(\s*\([^)]*acc[^)]*\)\s*=>\s*\{?[\s\S]*?\{?\s*\.\.\./g,
        severity: "warning",
        message: "Spread in reduce accumulator - O(n²) complexity, use mutation",
        fixable: true,
      },
    ],
  },
};

// Severity levels and their beads priority mapping
const SEVERITY_MAP = {
  critical: { priority: 0, label: "pre-commit-blocker" },
  warning: { priority: 1, label: null },
  info: { priority: 2, label: null },
};

/**
 * Get files to review based on git status
 */
function getChangedFiles(options = {}) {
  try {
    let command = "git diff --name-only";
    
    if (options.staged) {
      command = "git diff --cached --name-only";
    } else if (options.diffOnly) {
      command = "git diff --name-only";
    } else {
      // Default: review both staged and unstaged
      command = "git diff --name-only HEAD";
    }
    
    const output = execSync(command, { encoding: "utf-8" });
    const files = output.trim().split("\n").filter(f => f.length > 0);
    
    // Filter to only TypeScript/JavaScript files
    return files.filter(f => 
      f.match(/\.(ts|tsx|js|jsx)$/) && 
      !f.includes("node_modules") &&
      !f.includes("dist") &&
      !f.includes(".beads")
    );
  } catch (error) {
    console.error("Failed to get changed files:", error.message);
    return [];
  }
}

/**
 * Review a single file
 */
function reviewFile(filePath, content) {
  const issues = [];
  const lines = content.split("\n");
  
  for (const [categoryKey, category] of Object.entries(REVIEW_RULES)) {
    for (const check of category.checks) {
      const matches = content.matchAll(check.pattern);
      
      for (const match of matches) {
        // Find line number
        const pos = match.index;
        const lineNum = content.substring(0, pos).split("\n").length;
        const line = lines[lineNum - 1];
        
        issues.push({
          file: filePath,
          line: lineNum,
          category: category.name,
          severity: check.severity,
          message: check.message,
          code: line.trim(),
          fixable: check.fixable,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Create a beads issue for a problem
 */
function createBeadsIssue(issue) {
  const severity = SEVERITY_MAP[issue.severity];
  const title = issue.message.replace(/`/g, "");
  
  const command = [
    "bd create",
    `--title="${title} in ${path.basename(issue.file)}"`,
    "--type=task",
    `--priority=${severity.priority}`,
    severity.label ? `--label=${severity.label}` : "",
  ].filter(Boolean).join(" ");
  
  console.log(`  Creating issue: ${title}`);
  
  try {
    const result = execSync(command, { encoding: "utf-8" });
    const issueId = result.match(/ffractals0-[a-z0-9]+/)?.[0];
    return issueId;
  } catch (error) {
    console.error(`  Failed to create issue: ${error.message}`);
    return null;
  }
}

/**
 * Main review function
 */
async function runReview(options = {}) {
  console.log("🔍 Code Review Agent\n");
  console.log("Getting changed files...\n");
  
  const files = getChangedFiles(options);
  
  if (files.length === 0) {
    console.log("✅ No files to review");
    return { issues: [], hasBlockers: false };
  }
  
  console.log(`Reviewing ${files.length} file(s):`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log();
  
  const allIssues = [];
  
  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const issues = reviewFile(filePath, content);
      allIssues.push(...issues);
      
      if (issues.length > 0) {
        console.log(`\n${filePath}:`);
        
        for (const issue of issues) {
          const icon = issue.severity === "critical" ? "❌" : 
                       issue.severity === "warning" ? "⚠️" : "ℹ️";
          console.log(`  ${icon} Line ${issue.line}: ${issue.message}`);
          
          if (issue.severity !== "info") {
            const issueId = createBeadsIssue(issue);
            if (issueId) {
              console.log(`     Created: ${issueId}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`  Error reading ${filePath}: ${error.message}`);
    }
  }
  
  // Summary
  const critical = allIssues.filter(i => i.severity === "critical").length;
  const warnings = allIssues.filter(i => i.severity === "warning").length;
  const info = allIssues.filter(i => i.severity === "info").length;
  
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  if (critical > 0) {
    console.log(`❌ ${critical} critical issue(s) - MUST FIX BEFORE COMMIT`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning(s) - should be fixed`);
  }
  if (info > 0) {
    console.log(`ℹ️  ${info} info note(s)`);
  }
  if (allIssues.length === 0) {
    console.log("✅ No issues found - ready to commit!");
  }
  
  return {
    issues: allIssues,
    hasBlockers: critical > 0,
    summary: { critical, warnings, info },
  };
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  staged: args.includes("--staged"),
  diffOnly: args.includes("--diff-only"),
  fix: args.includes("--fix"),
  listBlockers: args.includes("--list-blockers"),
};

// Run review
runReview(options).then(result => {
  if (result.hasBlockers) {
    console.log("\n🚫 COMMIT BLOCKED - Fix critical issues first");
    process.exit(1);
  } else if (result.issues.length > 0) {
    console.log("\n⚠️  Issues found but not blocking - review recommended");
    process.exit(0);
  } else {
    console.log("\n✅ Review passed");
    process.exit(0);
  }
}).catch(error => {
  console.error("Review failed:", error);
  process.exit(1);
});

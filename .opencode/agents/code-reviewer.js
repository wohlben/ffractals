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

// Requirement Validation Checks
const REQUIREMENT_VALIDATION = {
  // Patterns that suggest over-engineering
  overEngineering: [
    {
      pattern: /interface\s+\w+\s*\{[^}]*\}\s*\n.*interface\s+\w+\s*\{[^}]*\}\s*\n.*interface\s+\w+/,
      message: "Multiple interfaces defined - is this level of abstraction necessary?",
      suggestion: "Consider if simpler types would suffice",
    },
    {
      pattern: /class\s+\w+.*\{[\s\S]{500,}\}/,
      message: "Large class detected (>500 chars) - may be doing too much",
      suggestion: "Consider splitting into focused, single-responsibility classes",
    },
    {
      pattern: /export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{300,}\}/,
      message: "Long function detected (>300 chars) - may need decomposition",
      suggestion: "Extract smaller, focused functions",
    },
  ],
  
  // Patterns that suggest missing edge cases
  missingEdgeCases: [
    {
      pattern: /if\s*\(\s*\w+\s*\)\s*\{[^}]*\}(?!\s*else)/,
      message: "Conditional without else - what happens in the else case?",
      suggestion: "Consider if explicit else handling is needed",
    },
    {
      pattern: /\.length\s*>\s*0|\.length\s*!==?\s*0/,
      message: "Array length check - what about empty array case?",
      suggestion: "Verify empty array handling is intentional",
    },
  ],
  
  // Patterns that suggest wrong abstraction level
  wrongAbstraction: [
    {
      pattern: /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?if[\s\S]*?for[\s\S]*?return/,
      message: "Complex arrow function - consider named function for clarity",
      suggestion: "Named functions are more debuggable and clearer",
    },
  ],
};

/**
 * Analyze changes for requirement validation concerns
 */
function validateRequirements(filePath, content) {
  const concerns = [];
  
  // Check for over-engineering
  for (const check of REQUIREMENT_VALIDATION.overEngineering) {
    if (check.pattern.test(content)) {
      concerns.push({
        type: "over-engineering",
        file: filePath,
        message: check.message,
        suggestion: check.suggestion,
        severity: "warning",
      });
    }
  }
  
  // Check for missing edge cases
  for (const check of REQUIREMENT_VALIDATION.missingEdgeCases) {
    if (check.pattern.test(content)) {
      concerns.push({
        type: "edge-case",
        file: filePath,
        message: check.message,
        suggestion: check.suggestion,
        severity: "warning",
      });
    }
  }
  
  // Check for wrong abstraction
  for (const check of REQUIREMENT_VALIDATION.wrongAbstraction) {
    if (check.pattern.test(content)) {
      concerns.push({
        type: "abstraction",
        file: filePath,
        message: check.message,
        suggestion: check.suggestion,
        severity: "warning",
      });
    }
  }
  
  return concerns;
}

/**
 * Create a beads issue for requirement validation concern
 */
function createValidationIssue(concern) {
  const title = concern.message.replace(/\?/g, "");
  
  const command = [
    "bd create",
    `"${title} in ${path.basename(concern.file)}"`,
    "--type=task",
    "--priority=1",
    "--label=needs-validation",
  ].join(" ");
  
  console.log(`  Creating validation issue: ${title}`);
  
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
  console.log("This agent challenges both 'how' (quality) and 'what' (requirements)\n");
  console.log("Getting changed files...\n");
  
  const files = getChangedFiles(options);
  
  if (files.length === 0) {
    console.log("✅ No files to review");
    return { issues: [], hasBlockers: false, validationConcerns: [] };
  }
  
  console.log(`Reviewing ${files.length} file(s):`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log();
  
  // Phase 1: Requirement Validation
  console.log("=".repeat(60));
  console.log("PHASE 1: REQUIREMENT VALIDATION");
  console.log("=".repeat(60));
  console.log("Challenging: Does this solve the problem? Is it the simplest way?\n");
  
  const validationConcerns = [];
  
  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const concerns = validateRequirements(filePath, content);
      validationConcerns.push(...concerns);
      
      if (concerns.length > 0) {
        console.log(`${filePath}:`);
        for (const concern of concerns) {
          const icon = concern.type === "over-engineering" ? "🏗️" :
                       concern.type === "edge-case" ? "❓" : "🤔";
          console.log(`  ${icon} ${concern.message}`);
          console.log(`     Suggestion: ${concern.suggestion}`);
          
          if (!options.skipValidation) {
            const issueId = createValidationIssue(concern);
            if (issueId) {
              console.log(`     Created: ${issueId} (P1, needs-validation)`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`  Error validating ${filePath}: ${error.message}`);
    }
  }
  
  if (validationConcerns.length === 0) {
    console.log("✅ No obvious requirement validation concerns found");
    console.log("   Still ask yourself: Does this actually solve the problem?\n");
  } else {
    console.log();
  }
  
  // Phase 2: Code Quality Review
  console.log("=".repeat(60));
  console.log("PHASE 2: CODE QUALITY REVIEW");
  console.log("=".repeat(60));
  console.log("Checking: Type safety, best practices, performance\n");
  
  const allIssues = [];
  
  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const issues = reviewFile(filePath, content);
      allIssues.push(...issues);
      
      if (issues.length > 0) {
        console.log(`${filePath}:`);
        
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
        console.log();
      }
    } catch (error) {
      console.error(`  Error reading ${filePath}: ${error.message}`);
    }
  }
  
  if (allIssues.length === 0) {
    console.log("✅ No code quality issues found\n");
  }
  
  // Summary
  const critical = allIssues.filter(i => i.severity === "critical").length;
  const warnings = allIssues.filter(i => i.severity === "warning").length;
  const info = allIssues.filter(i => i.severity === "info").length;
  
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  if (validationConcerns.length > 0) {
    const overEng = validationConcerns.filter(c => c.type === "over-engineering").length;
    const edgeCases = validationConcerns.filter(c => c.type === "edge-case").length;
    const abstraction = validationConcerns.filter(c => c.type === "abstraction").length;
    
    console.log(`💭 Requirement Validation:`);
    if (overEng > 0) console.log(`  🏗️  ${overEng} potential over-engineering`);
    if (edgeCases > 0) console.log(`  ❓ ${edgeCases} missing edge cases`);
    if (abstraction > 0) console.log(`  🤔 ${abstraction} abstraction concerns`);
  }
  
  if (critical > 0) {
    console.log(`❌ ${critical} critical issue(s) - MUST FIX BEFORE COMMIT`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning(s) - should be fixed`);
  }
  if (info > 0) {
    console.log(`ℹ️  ${info} info note(s)`);
  }
  if (allIssues.length === 0 && validationConcerns.length === 0) {
    console.log("✅ No issues found - ready to commit!");
  }
  
  return {
    issues: allIssues,
    hasBlockers: critical > 0,
    validationConcerns,
    summary: { critical, warnings, info, validation: validationConcerns.length },
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
  console.log();
  
  if (result.hasBlockers) {
    console.log("🚫 COMMIT BLOCKED - Fix critical technical issues first");
    console.log("   Then re-run the review");
    process.exit(1);
  } else if (result.validationConcerns.length > 0) {
    console.log("⚠️  REQUIREMENT VALIDATION CONCERNS FOUND");
    console.log("   Review these concerns and either:");
    console.log("   1. Justify the approach in the created beads issues, OR");
    console.log("   2. Revise the solution to be simpler");
    console.log("   Technical issues: " + (result.issues.length > 0 ? "present" : "none"));
    process.exit(0);
  } else if (result.issues.length > 0) {
    console.log("⚠️  Technical issues found but not blocking - review recommended");
    process.exit(0);
  } else {
    console.log("✅ Review passed");
    console.log("   Remember: 'No issues' ≠ 'Correct solution'");
    console.log("   Always ask: Does this actually solve the problem?");
    process.exit(0);
  }
}).catch(error => {
  console.error("Review failed:", error);
  process.exit(1);
});

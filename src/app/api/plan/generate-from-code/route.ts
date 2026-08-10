import { NextResponse } from "next/server";
import { generatePlanFromCode, extractConcepts, generateStageProject } from "@/lib/ai";
import {
  createPlan, createStage, updatePlan,
  createConcept, createRelation, createStageProject, getStagesByPlan,
} from "@/db/queries";
import fs from "fs";
import path from "path";

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".output",
  "__pycache__", ".pytest_cache", ".mypy_cache", ".tox",
  "vendor", ".idea", ".vscode", ".cursor", ".workflow",
  "coverage", ".nyc_output", ".cache", ".turbo", ".vercel",
  ".svn", ".hg", "target", "bin", "obj", ".gradle",
  "Pods", ".dart_tool", ".pub-cache",
]);

const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte",
  ".py", ".pyx", ".pyi",
  ".go",
  ".java", ".kt", ".kts", ".scala",
  ".rs",
  ".c", ".cpp", ".cc", ".h", ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift", ".m", ".mm",
  ".dart",
  ".lua",
  ".sh", ".bash", ".zsh",
  ".sql",
  ".proto",
  ".graphql", ".gql",
  ".yaml", ".yml", ".toml",
  ".wxml", ".wxss",
]);

const CONFIG_FILES = new Set([
  "package.json", "tsconfig.json", "go.mod", "go.sum",
  "Cargo.toml", "pom.xml", "build.gradle", "Makefile",
  "Dockerfile", "docker-compose.yml", "requirements.txt",
  "pyproject.toml", "setup.py", "Gemfile",
  "pubspec.yaml", ".env.example", "app.json", "project.config.json",
]);

const MAX_FILE_SIZE = 30_000;
const MAX_TOTAL_CHARS = 80_000;

interface FileEntry {
  relativePath: string;
  content: string;
  size: number;
}

function shouldIncludeFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return CODE_EXTENSIONS.has(ext) || CONFIG_FILES.has(name);
}

function walkDir(dirPath: string, basePath: string, files: FileEntry[], totalChars: { count: number }) {
  if (totalChars.count >= MAX_TOTAL_CHARS) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const sortedEntries = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sortedEntries) {
    if (totalChars.count >= MAX_TOTAL_CHARS) break;

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      walkDir(path.join(dirPath, entry.name), basePath, files, totalChars);
    } else if (entry.isFile() && shouldIncludeFile(entry.name)) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_FILE_SIZE || stat.size === 0) continue;

        const content = fs.readFileSync(fullPath, "utf-8");
        if (totalChars.count + content.length > MAX_TOTAL_CHARS) {
          const remaining = MAX_TOTAL_CHARS - totalChars.count;
          if (remaining > 500) {
            files.push({ relativePath, content: content.slice(0, remaining) + "\n// [truncated]", size: stat.size });
            totalChars.count = MAX_TOTAL_CHARS;
          }
          break;
        }

        files.push({ relativePath, content, size: stat.size });
        totalChars.count += content.length;
      } catch {
        // skip unreadable files
      }
    }
  }
}

function buildFileTree(dirPath: string, basePath: string, prefix: string = "", depth: number = 0, maxDepth: number = 4): string {
  if (depth > maxDepth) return prefix + "...\n";

  let result = "";
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return result;
  }

  const filtered = entries
    .filter(e => {
      if (e.isDirectory()) return !IGNORED_DIRS.has(e.name) && !e.name.startsWith(".");
      return shouldIncludeFile(e.name);
    })
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";

    if (entry.isDirectory()) {
      result += prefix + connector + entry.name + "/\n";
      result += buildFileTree(
        path.join(dirPath, entry.name), basePath,
        prefix + childPrefix, depth + 1, maxDepth
      );
    } else {
      result += prefix + connector + entry.name + "\n";
    }
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      project_path,
      duration_weeks = 4,
      daily_hours = 2,
      skill_level = "beginner",
      motivation = "",
      background = "",
      expected_outcome = "",
    } = body;

    if (!project_path?.trim()) {
      return NextResponse.json({ error: "请输入项目路径" }, { status: 400 });
    }

    const resolvedPath = project_path.replace(/^~/, process.env.HOME || "");

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "项目路径不存在" }, { status: 400 });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "请提供一个目录路径" }, { status: 400 });
    }

    const projectName = path.basename(resolvedPath);
    const fileTree = buildFileTree(resolvedPath, resolvedPath);

    if (!fileTree.trim()) {
      return NextResponse.json({ error: "项目中未找到可识别的源代码文件" }, { status: 400 });
    }

    if (body.validate_only) {
      return NextResponse.json({ valid: true, project_name: projectName });
    }

    const files: FileEntry[] = [];
    const totalChars = { count: 0 };
    walkDir(resolvedPath, resolvedPath, files, totalChars);

    if (files.length === 0) {
      return NextResponse.json({ error: "项目中未找到可读取的源代码文件" }, { status: 400 });
    }

    const codeContent = files.map(f =>
      `=== ${f.relativePath} ===\n${f.content}`
    ).join("\n\n");

    const generated = await generatePlanFromCode({
      code_content: codeContent,
      project_name: projectName,
      file_tree: fileTree,
      duration_weeks,
      daily_hours,
      skill_level,
      motivation,
      background,
      expected_outcome,
    });

    const goalDesc = `深入学习项目「${projectName}」的代码实现`;

    const planId = createPlan({
      title: generated.plan_title,
      goal_description: goalDesc,
      duration_weeks,
      daily_hours,
      skill_level,
      user_motivation: motivation,
      user_background: background,
      expected_outcome,
    });

    updatePlan(planId, {
      total_stages: generated.stages.length,
      started_at: new Date().toISOString(),
    } as unknown as import("@/db/queries").LearningPlan);

    for (let i = 0; i < generated.stages.length; i++) {
      const stage = generated.stages[i];
      createStage({
        plan_id: planId,
        order_index: i,
        title: stage.title,
        description: stage.description,
        key_topics: stage.key_topics,
        estimated_days: stage.estimated_days,
        summary_text: stage.summary_text,
        core_output: stage.core_output || "",
        real_world_cases: stage.real_world_cases || [],
        assessment_questions: stage.assessment_questions || [],
        learning_objectives: stage.learning_objectives || [],
      });
    }

    try {
      const stageData = generated.stages.map((s, i) => ({
        title: s.title,
        key_topics: s.key_topics,
        learning_objectives: s.learning_objectives || [],
        order_index: i,
      }));

      const conceptResult = await extractConcepts({
        plan_title: generated.plan_title,
        stages: stageData,
      });

      const conceptIdMap = new Map<string, string>();
      for (const c of conceptResult.concepts) {
        const stageIds = generated.stages
          .filter((_, idx) => idx === c.stage_index)
          .map((_, idx) => stageData[idx]?.title || "");
        const cid = createConcept({
          plan_id: planId,
          name: c.name,
          definition: c.definition,
          mastery_status: "untouched",
          source_stage_ids: stageIds,
        });
        conceptIdMap.set(c.name, cid);
      }

      for (const r of conceptResult.relations) {
        const fromId = conceptIdMap.get(r.from);
        const toId = conceptIdMap.get(r.to);
        if (fromId && toId) {
          createRelation({
            plan_id: planId,
            from_concept_id: fromId,
            to_concept_id: toId,
            relation_type: r.type,
            source: "ai",
          });
        }
      }
    } catch (e) {
      console.error("Concept extraction failed (non-fatal):", e);
    }

    try {
      const firstStage = generated.stages[0];
      if (firstStage) {
        const project = await generateStageProject({
          stage_title: firstStage.title,
          key_topics: firstStage.key_topics,
          core_output: firstStage.core_output || "",
          real_world_cases: firstStage.real_world_cases || [],
          goal: goalDesc,
          skill_level,
        });

        const stageRows = getStagesByPlan(planId);
        if (stageRows[0]) {
          createStageProject({
            stage_id: stageRows[0].id,
            title: project.title,
            description: project.description,
            expected_output: project.expected_output,
            checklist: project.checklist,
            difficulty: project.difficulty,
            estimated_minutes: project.estimated_minutes,
          });
        }
      }
    } catch (e) {
      console.error("Project generation failed (non-fatal):", e);
    }

    return NextResponse.json({
      planId,
      plan: generated,
      stats: { files_read: files.length, total_chars: totalChars.count },
    });
  } catch (e) {
    console.error("Code plan generation failed:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

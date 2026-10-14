#!/usr/bin/env node
// .env.local 상태 점검 — 로컬 개발 시작 전에 돌리세요.
// 사용법: pnpm env:check

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env.local");

const required = {
  NEXT_PUBLIC_SUPABASE_URL: {
    description: "Supabase Project URL",
    validate: (v) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(v),
    hint: "https://xxxxxxxx.supabase.co 형식, 끝에 슬래시 X",
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    description: "Supabase anon public key",
    validate: (v) => v.startsWith("eyJ") && v.length > 100,
    hint: "'eyJ' 로 시작하는 긴 JWT",
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    description: "Supabase service_role key",
    validate: (v) => v.startsWith("eyJ") && v.length > 100,
    hint: "'eyJ' 로 시작하는 긴 JWT (⚠️ 공개 금지)",
  },
  OPENAI_API_KEY: {
    description: "OpenAI API key",
    validate: (v) => /^sk-[A-Za-z0-9_-]{20,}$/.test(v),
    hint: "'sk-' 로 시작",
  },
  NEXT_PUBLIC_APP_URL: {
    description: "앱 베이스 URL",
    validate: (v) => /^https?:\/\/.+/.test(v) && !v.endsWith("/"),
    hint: "http://localhost:3000 (로컬 기본값)",
  },
};

const optional = {
  SUPADATA_API_KEY: {
    description: "Supadata 자막 공급 키 (로컬 PoC와 Edge Function Secrets)",
    validate: (v) => /^sd_[A-Za-z0-9_-]{20,}$/.test(v),
    hint: "Supadata에서 발급한 API 키, Edge Function Secrets에도 별도 설정",
  },
  WORKER_SECRET: {
    description: "서버와 Edge Function이 공유하는 워커 인증 시크릿",
    validate: (v) => v.length >= 32 && !v.startsWith("TODO_"),
    hint: "32자 이상 랜덤 값, Edge Function WORKER_SECRET과 동일하게 설정",
  },
  SUPABASE_WORKER_URL: {
    description: "Edge Function worker URL (Phase 5 이후)",
    validate: (v) => v === "" || /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/process-job$/.test(v),
    hint: "Phase 5 끝나면 채움",
  },
};

if (!existsSync(envPath)) {
  console.error("❌ .env.local 파일이 없습니다.");
  console.error("   먼저 `cp .env.local.example .env.local` 실행 후 값을 채우세요.");
  process.exit(1);
}

const raw = readFileSync(envPath, "utf-8");
const env = {};
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  env[key] = value;
}

let hasError = false;
let hasWarn = false;

console.log("\n🔍 .env.local 점검\n");

for (const [key, { description, validate, hint }] of Object.entries(required)) {
  const value = env[key];
  if (!value || value.startsWith("TODO_")) {
    console.log(`❌ ${key}`);
    console.log(`   ${description}`);
    console.log(`   💡 ${hint}\n`);
    hasError = true;
  } else if (!validate(value)) {
    console.log(`⚠️  ${key} 형식이 이상합니다`);
    console.log(`   💡 ${hint}\n`);
    hasError = true;
  } else {
    console.log(`✅ ${key}`);
  }
}

console.log("");

for (const [key, { description, validate, hint }] of Object.entries(optional)) {
  const value = env[key] ?? "";
  if (!value) {
    if (key === "WORKER_SECRET" && env.SUPABASE_WORKER_URL) {
      console.log(`❌ ${key} — 워커 URL 설정 시 필수`);
      console.log(`   💡 ${hint}`);
      hasError = true;
      continue;
    }
    console.log(`⏭️  ${key} (선택) — ${description}`);
    hasWarn = true;
  } else if (!validate(value)) {
    console.log(`⚠️  ${key} 형식이 이상합니다`);
    console.log(`   💡 ${hint}`);
    hasError = true;
  } else {
    console.log(`✅ ${key}`);
  }
}

console.log("");
if (hasError) {
  console.log("❌ 설정 미완료. 위 항목을 .env.local 에서 수정하세요.");
  process.exit(1);
} else if (hasWarn) {
  console.log("⚠️  필수 항목은 OK. SUPABASE_WORKER_URL 은 Edge Function 배포 후 채우면 됩니다.");
} else {
  console.log("🎉 모두 OK! `pnpm dev` 로 실행하세요.");
}

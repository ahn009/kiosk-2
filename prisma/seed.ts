import { db } from "../src/lib/db";
import {
  buildToken,
  generateEmbedding,
  hashSecret,
  sha256,
} from "../src/lib/crypto";

async function main() {
  console.log("Seeding database...");

  // ---- System state (singleton) ----
  await db.systemState.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      lockdownActive: false,
      crlVersion: 1,
      orgCode: "ACME",
      orgName: "Acme Corporation",
    },
  });

  // ---- Departments ----
  const departments = [
    { name: "Engineering", code: "ENG" },
    { name: "Security", code: "SEC" },
    { name: "Human Resources", code: "HR" },
    { name: "Operations", code: "OPS" },
    { name: "Executive", code: "EXEC" },
    { name: "Research & Development", code: "RND" },
  ];
  const deptIds: Record<string, string> = {};
  for (const d of departments) {
    const rec = await db.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: d,
    });
    deptIds[d.code] = rec.id;
  }

  // ---- Demo identity data gate ----
  // Everything below (demo admins with known passwords, demo employees with
  // simulated face embeddings, fake scan history) is a development/demo
  // fixture. It must NEVER be created in production. Allowed in
  // non-production, or in production only with explicit DEMO_MODE=true.
  const demoSeedAllowed =
    process.env.DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "1" ||
    process.env.NODE_ENV !== "production";
  if (!demoSeedAllowed) {
    console.log("Seeded system state + departments.");
    console.log(
      "Production mode: skipping demo identity seed (admins, employees, kiosks, scan history)."
    );
    console.log(
      "Create the first superadmin with: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong-password>' bun prisma/bootstrap-admin.ts"
    );
    return;
  }

  // ---- Admin users ----
  const admins = [
    { email: "admin@acme.io", name: "Sarah Chen", role: "superadmin", password: "Admin@2024" },
    { email: "security@acme.io", name: "Marcus Webb", role: "security_officer", password: "Secure@2024" },
    { email: "hr@acme.io", name: "Priya Nair", role: "hr_admin", password: "Hradmin@2024" },
    { email: "viewer@acme.io", name: "Tom Becker", role: "viewer", password: "View@2024" },
  ];
  for (const a of admins) {
    await db.adminUser.upsert({
      where: { email: a.email },
      update: {},
      create: {
        email: a.email,
        name: a.name,
        role: a.role,
        passwordHash: hashSecret(a.password),
      },
    });
  }

  // ---- Kiosks ----
  const kiosks = [
    { kioskId: "KSK-001", name: "Main Lobby", location: "HQ Building A - Lobby" },
    { kioskId: "KSK-002", name: "Server Room", location: "HQ Building B - L1" },
    { kioskId: "KSK-003", name: "R&D Lab", location: "Innovation Center - L2" },
    { kioskId: "KSK-004", name: "Warehouse Gate", location: "Distribution Center - North" },
  ];
  for (const k of kiosks) {
    await db.kiosk.upsert({
      where: { kioskId: k.kioskId },
      update: {},
      create: {
        ...k,
        status: "online",
        thresholdGranted: 0.85,
        thresholdChallenge: 0.6,
        challengeMode: "liveness",
        crlVersion: 1,
      },
    });
  }

  // ---- Employees ----
  const employeeSeed = [
    { code: "EMP-1001", name: "James Carter", dept: "ENG", designation: "Senior Engineer", accessLevel: 3 },
    { code: "EMP-1002", name: "Elena Rodriguez", dept: "EXEC", designation: "CTO", accessLevel: 5 },
    { code: "EMP-1003", name: "David Kim", dept: "SEC", designation: "Security Lead", accessLevel: 4 },
    { code: "EMP-1004", name: "Aisha Khan", dept: "HR", designation: "HR Manager", accessLevel: 3 },
    { code: "EMP-1005", name: "Liam O'Brien", dept: "OPS", designation: "Operations Director", accessLevel: 4 },
    { code: "EMP-1006", name: "Nina Petrova", dept: "RND", designation: "Research Scientist", accessLevel: 3 },
    { code: "EMP-1007", name: "Omar Hassan", dept: "ENG", designation: "DevOps Engineer", accessLevel: 2 },
    { code: "EMP-1008", name: "Grace Liu", dept: "ENG", designation: "Frontend Developer", accessLevel: 2 },
    { code: "EMP-1009", name: "Felix Schmidt", dept: "OPS", designation: "Warehouse Lead", accessLevel: 2 },
    { code: "EMP-1010", name: "Yuki Tanaka", dept: "RND", designation: "ML Engineer", accessLevel: 3 },
    { code: "EMP-1011", name: "Sofia Mendez", dept: "SEC", designation: "Security Officer", accessLevel: 3 },
    { code: "EMP-1012", name: "Robert Hayes", dept: "ENG", designation: "Backend Developer", accessLevel: 2 },
  ];

  const expEpoch = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2; // +2 years
  const photoSeeds = [
    "person1", "person2", "person3", "person4", "person5", "person6",
    "person7", "person8", "person9", "person10", "person11", "person12",
  ];

  for (let i = 0; i < employeeSeed.length; i++) {
    const e = employeeSeed[i];
    // Enroll face for most employees (10 of 12), leave 2 without face enrollment
    const enrollFace = i < 10;
    const { token } = buildToken({ orgCode: "ACME", expEpoch });
    const tokenHash = sha256(token);

    const existing = await db.employee.findUnique({ where: { employeeCode: e.code } });
    if (existing) {
      // keep existing, just ensure card token + embedding set
      await db.employee.update({
        where: { id: existing.id },
        data: {
          fullName: e.name,
          departmentId: deptIds[e.dept],
          designation: e.designation,
          accessLevel: e.accessLevel,
          photoUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(e.name)}&backgroundColor=0d9488,14b8a6,0f766e`,
          cardStatus: "active",
          cardTokenHash: tokenHash,
          cardExpiresAt: new Date((expEpoch) * 1000),
        },
      });
      continue;
    }

    const emp = await db.employee.create({
      data: {
        employeeCode: e.code,
        fullName: e.name,
        departmentId: deptIds[e.dept],
        designation: e.designation,
        accessLevel: e.accessLevel,
        photoUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(e.name)}&backgroundColor=0d9488,14b8a6,0f766e`,
        cardStatus: "active",
        cardTokenHash: tokenHash,
        cardExpiresAt: new Date((expEpoch) * 1000),
        ...(enrollFace
          ? {
              faceEmbedding: JSON.stringify(generateEmbedding(e.code)),
              faceEnrolledAt: new Date(),
              faceConsentAt: new Date(),
            }
          : {}),
      },
    });

    if (enrollFace) {
      await db.enrollment.create({
        data: {
          employeeId: emp.id,
          consentAcknowledged: true,
          imageQualityScore: 0.85 + Math.random() * 0.12,
        },
      });
    }
  }

  // One revoked card (revocation list)
  const revokedEmp = await db.employee.findUnique({ where: { employeeCode: "EMP-1007" } });
  if (revokedEmp?.cardTokenHash) {
    await db.revocation.upsert({
      where: { tokenHash: revokedEmp.cardTokenHash },
      update: {},
      create: { tokenHash: revokedEmp.cardTokenHash, reason: "Card reported lost" },
    });
    await db.employee.update({
      where: { id: revokedEmp.id },
      data: { cardStatus: "lost" },
    });
  }

  // ---- Scan history (last 7 days) ----
  const allKiosks = await db.kiosk.findMany();
  const enrolledEmployees = await db.employee.findMany({
    where: { faceEmbedding: { not: null } },
  });

  const decisions: ("granted" | "denied")[] = ["granted", "granted", "granted", "granted", "denied", "granted"];
  const now = Date.now();
  let scanId = 1;
  for (let d = 6; d >= 0; d--) {
    const dayStart = now - d * 24 * 60 * 60 * 1000;
    const scansToday = 8 + Math.floor(Math.random() * 20);
    for (let s = 0; s < scansToday; s++) {
      const t = dayStart - Math.floor(Math.random() * 24 * 60 * 60 * 1000);
      const kiosk = allKiosks[Math.floor(Math.random() * allKiosks.length)];
      const emp = enrolledEmployees[Math.floor(Math.random() * enrolledEmployees.length)];
      const decision = decisions[Math.floor(Math.random() * decisions.length)];
      const score = decision === "granted" ? 0.86 + Math.random() * 0.12 : 0.3 + Math.random() * 0.3;
      await db.scanEvent.create({
        data: {
          kioskId: kiosk.kioskId,
          employeeId: decision === "granted" ? emp.id : Math.random() > 0.5 ? emp.id : null,
          tokenHash: emp.cardTokenHash,
          faceMatchScore: score,
          faceMatchStatus: decision === "granted" ? "match" : Math.random() > 0.5 ? "mismatch" : "liveness_fail",
          spoofFlags: decision === "denied" && Math.random() > 0.5 ? JSON.stringify({ paper_detected: true }) : null,
          decision,
          latencyMs: 600 + Math.floor(Math.random() * 1100),
          offline: Math.random() > 0.92,
          createdAt: new Date(t),
        },
      });
      scanId += 1;
    }
  }

  console.log("Seed complete.");
  console.log(`- Departments: ${departments.length}`);
  console.log(`- Employees: ${employeeSeed.length} (10 face-enrolled)`);
  console.log(`- Kiosks: ${kiosks.length}`);
  console.log(`- Admin users: ${admins.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

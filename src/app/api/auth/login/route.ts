import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword, setSessionCookie } from "@/lib/auth";

async function ensureAdminSeeded() {
  const userCount = await prisma.user.count();
  if (userCount === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8) {
    await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL,
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD),
      },
    });
    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Auto-seed admin from env vars if DB is empty
    await ensureAdminSeeded();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    await setSessionCookie({ userId: user.id, email: user.email });

    return NextResponse.json({ success: true, email: user.email });
  } catch (err) {
    console.error("Login error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}

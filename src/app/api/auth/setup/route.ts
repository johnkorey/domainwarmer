import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({ needsSetup: userCount === 0 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only allow setup if no users exist
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Setup already completed. Use login instead." },
        { status: 403 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
      },
    });

    // Create default settings
    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    // Auto-login
    await setSessionCookie({ userId: user.id, email: user.email });

    return NextResponse.json({ success: true, email: user.email });
  } catch (err) {
    console.error("Setup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

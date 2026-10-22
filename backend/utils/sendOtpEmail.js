
import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (!transporter) {
    const smtpPort = Number(process.env.SMTP_PORT || 587);

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure:
        process.env.SMTP_SECURE === "true" ||
        smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendOtpEmail(email, otp) {
  const requiredSettings = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM",
  ];

  const missing = requiredSettings.filter(
    (key) => !process.env[key]?.trim()
  );

  if (missing.length) {
    throw new Error(
      `Missing email settings: ${missing.join(", ")}`
    );
  }

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Verify your WhatsApp Clone account",
      text: [
        `Your verification code is: ${otp}`,
        "",
        `This code expires in ${
          process.env.OTP_EXPIRY_MINUTES || 10
        } minutes.`,
        "",
        "If you did not request this code, ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
          <h2 style="color:#075e54">Verify your email</h2>
          <p>Use this code to complete registration:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">
            ${otp}
          </div>
          <p>This code expires in ${
            Number(process.env.OTP_EXPIRY_MINUTES) || 10
          } minutes.</p>
          <p>If you did not request this code, ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("SMTP diagnostic:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      command: error?.command,
      errors: error?.errors?.map((e) => ({
        name: e.name,
        code: e.code,
        message: e.message,
        address: e.address,
        port: e.port,
        syscall: e.syscall,
      })),
    });

    throw error;
  }
}

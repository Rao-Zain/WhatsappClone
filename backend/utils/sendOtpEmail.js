
// import nodemailer from "nodemailer";

// let transporter;

// function getTransporter() {
//   if (!transporter) {
//     const smtpPort = Number(process.env.SMTP_PORT || 587);

//     transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: smtpPort,
//       secure:
//         process.env.SMTP_SECURE === "true" ||
//         smtpPort === 465,
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });
//   }

//   return transporter;
// }

// export async function sendOtpEmail(email, otp) {
//   const requiredSettings = [
//     "SMTP_HOST",
//     "SMTP_USER",
//     "SMTP_PASS",
//     "EMAIL_FROM",
//   ];

//   const missing = requiredSettings.filter(
//     (key) => !process.env[key]?.trim()
//   );

//   if (missing.length) {
//     throw new Error(
//       `Missing email settings: ${missing.join(", ")}`
//     );
//   }

//   try {
//     await getTransporter().sendMail({
//       from: process.env.EMAIL_FROM,
//       to: email,
//       subject: "Verify your HexaChat account",
//       text: [
//         `Your verification code is: ${otp}`,
//         "",
//         `This code expires in ${
//           process.env.OTP_EXPIRY_MINUTES || 10
//         } minutes.`,
//         "",
//         "If you did not request this code, ignore this email.",
//       ].join("\n"),
//       html: `
//         <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
//           <h2 style="color:#075e54">Verify your email</h2>
//           <p>Use this code to complete registration:</p>
//           <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">
//             ${otp}
//           </div>
//           <p>This code expires in ${
//             Number(process.env.OTP_EXPIRY_MINUTES) || 10
//           } minutes.</p>
//           <p>If you did not request this code, ignore this email.</p>
//         </div>
//       `,
//     });
//   } catch (error) {
//     console.error("SMTP diagnostic:", {
//       name: error?.name,
//       message: error?.message,
//       code: error?.code,
//       command: error?.command,
//       errors: error?.errors?.map((e) => ({
//         name: e.name,
//         code: e.code,
//         message: e.message,
//         address: e.address,
//         port: e.port,
//         syscall: e.syscall,
//       })),
//     });

//     throw error;
//   }
// }

// /* ------------------------------------------------------------------ */
// /* Password reset emails                                               */
// /* ------------------------------------------------------------------ */

// function assertEmailSettings() {
//   const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"].filter(
//     (key) => !process.env[key]?.trim()
//   );

//   if (missing.length) {
//     throw new Error(`Missing email settings: ${missing.join(", ")}`);
//   }
// }

// export async function sendPasswordResetEmail(email, otp) {
//   assertEmailSettings();

//   const minutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

//   await getTransporter().sendMail({
//     from: process.env.EMAIL_FROM,
//     to: email,
//     subject: "Reset your HexaChat password",
//     text: [
//       `Your password reset code is: ${otp}`,
//       "",
//       `This code expires in ${minutes} minutes.`,
//       "",
//       "If you did not ask to reset your password, you can ignore this email.",
//       "Your password will not change unless the code is used.",
//     ].join("\n"),
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
//         <h2 style="color:#075e54">Reset your password</h2>
//         <p>Use this code to choose a new password:</p>
//         <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">
//           ${otp}
//         </div>
//         <p>This code expires in ${minutes} minutes.</p>
//         <p>If you did not ask to reset your password, you can ignore this email. Your password will not change unless the code is used.</p>
//       </div>
//     `,
//   });
// }

// export async function sendPasswordChangedEmail(email) {
//   assertEmailSettings();

//   await getTransporter().sendMail({
//     from: process.env.EMAIL_FROM,
//     to: email,
//     subject: "Your HexaChat password was changed",
//     text: [
//       "The password for your account was just changed, and you were signed out on all devices.",
//       "",
//       "If this was not you, reset your password again right away.",
//     ].join("\n"),
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
//         <h2 style="color:#075e54">Password changed</h2>
//         <p>The password for your account was just changed, and you were signed out on all devices.</p>
//         <p>If this was not you, reset your password again right away.</p>
//       </div>
//     `,
//   });
// }




// backend/utils/sendOtpEmail.js
// Sends email through Brevo's HTTPS API (works on Render's free tier,
// where outbound SMTP ports are blocked).

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

function getApiKey() {
  return (process.env.BREVO_API_KEY || process.env.BREVO_API || "").trim();
}

function assertEmailSettings() {
  const missing = [];
  if (!getApiKey()) missing.push("BREVO_API_KEY");
  if (!process.env.BREVO_SENDER_EMAIL?.trim()) missing.push("BREVO_SENDER_EMAIL");

  if (missing.length) {
    throw new Error(`Missing email settings: ${missing.join(", ")}`);
  }
}

async function sendEmail({ to, subject, text, html }) {
  assertEmailSettings();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": getApiKey(),
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || "HexaChat",
          email: process.env.BREVO_SENDER_EMAIL.trim(),
        },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Brevo error:", res.status, body);
      throw new Error(`Brevo responded with ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function sendOtpEmail(email, otp) {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

  await sendEmail({
    to: email,
    subject: "Verify your HexaChat account",
    text: [
      `Your verification code is: ${otp}`,
      "",
      `This code expires in ${minutes} minutes.`,
      "",
      "If you did not request this code, ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
        <h2 style="color:#075e54">Verify your email</h2>
        <p>Use this code to complete registration:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">${otp}</div>
        <p>This code expires in ${minutes} minutes.</p>
        <p>If you did not request this code, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email, otp) {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

  await sendEmail({
    to: email,
    subject: "Reset your HexaChat password",
    text: [
      `Your password reset code is: ${otp}`,
      "",
      `This code expires in ${minutes} minutes.`,
      "",
      "If you did not ask to reset your password, you can ignore this email.",
      "Your password will not change unless the code is used.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
        <h2 style="color:#075e54">Reset your password</h2>
        <p>Use this code to choose a new password:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">${otp}</div>
        <p>This code expires in ${minutes} minutes.</p>
        <p>If you did not ask to reset your password, you can ignore this email. Your password will not change unless the code is used.</p>
      </div>
    `,
  });
}

export async function sendPasswordChangedEmail(email) {
  await sendEmail({
    to: email,
    subject: "Your HexaChat password was changed",
    text: [
      "The password for your account was just changed, and you were signed out on all devices.",
      "",
      "If this was not you, reset your password again right away.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
        <h2 style="color:#075e54">Password changed</h2>
        <p>The password for your account was just changed, and you were signed out on all devices.</p>
        <p>If this was not you, reset your password again right away.</p>
      </div>
    `,
  });
}
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendDeadlineReminder(
  to: string,
  taskTitle: string,
  deadline: Date
): Promise<void> {
  const deadlineStr = deadline.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await transporter.sendMail({
    from: `"Brain Dump" <${process.env.SMTP_USER}>`,
    to,
    subject: `⏰ Termin zbliża się: ${taskTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #7c5cff;">Przypomnienie o terminie</h2>
        <p>Zadanie <strong>${taskTitle}</strong> ma termin <strong>${deadlineStr}</strong>.</p>
        <p>Zaloguj się do <a href="${process.env.NEXTAUTH_URL}">Brain Dump</a>, żeby oznaczyć je jako ukończone.</p>
      </div>
    `,
  });
}

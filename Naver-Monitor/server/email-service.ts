import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export async function sendVerificationEmail(toEmail: string, verificationToken: string, userName?: string) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const verificationUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/api/auth/verify-email?token=${verificationToken}`;
  
  const msg = {
    to: toEmail,
    from: fromEmail,
    subject: '네이버 통합 모니터링 - 이메일 인증',
    html: `
      <div style="font-family: 'Noto Sans KR', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">네이버 통합 모니터링</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">이메일 인증을 완료해주세요</h2>
          <p style="color: #666; line-height: 1.6;">
            ${userName ? `안녕하세요, ${userName}님!` : '안녕하세요!'}<br><br>
            네이버 통합 모니터링 서비스에 가입해 주셔서 감사합니다.<br>
            아래 버튼을 클릭하여 이메일 인증을 완료해주세요.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 40px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: bold;
                      display: inline-block;">
              이메일 인증하기
            </a>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            이 링크는 24시간 동안 유효합니다.<br>
            본인이 가입하지 않으셨다면 이 이메일을 무시해주세요.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await client.send(msg);
    console.log(`[Email] Verification email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string, userName?: string) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const resetUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  const msg = {
    to: toEmail,
    from: fromEmail,
    subject: '네이버 통합 모니터링 - 비밀번호 재설정',
    html: `
      <div style="font-family: 'Noto Sans KR', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">네이버 통합 모니터링</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">비밀번호 재설정</h2>
          <p style="color: #666; line-height: 1.6;">
            ${userName ? `안녕하세요, ${userName}님!` : '안녕하세요!'}<br><br>
            비밀번호 재설정 요청을 받았습니다.<br>
            아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 40px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: bold;
                      display: inline-block;">
              비밀번호 재설정
            </a>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            이 링크는 1시간 동안 유효합니다.<br>
            본인이 요청하지 않으셨다면 이 이메일을 무시해주세요.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await client.send(msg);
    console.log(`[Email] Password reset email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    throw error;
  }
}

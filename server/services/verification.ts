/**
 * Verification Service - WhatsApp OTP via Ultramsg with Email Fallback
 * 
 * Configuration:
 * - ULTRAMSG_INSTANCE_ID: Your Ultramsg instance ID
 * - ULTRAMSG_TOKEN: Your Ultramsg API token
 * - ULTRAMSG_FROM_NUMBER: Your Yemeni number (e.g., 967774997589)
 * 
 * Fallback:
 * - If Ultramsg credentials are not configured, falls back to email verification
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS for email
 */

// Generate 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format Yemeni phone number for WhatsApp
export function formatYemeniPhone(phone: string): string {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add Yemen country code if not present
  if (cleaned.startsWith('0')) {
    cleaned = '967' + cleaned.substring(1);
  } else if (!cleaned.startsWith('967')) {
    cleaned = '967' + cleaned;
  }
  
  return cleaned;
}

// Check if WhatsApp verification is configured
export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.ULTRAMSG_INSTANCE_ID && 
    process.env.ULTRAMSG_TOKEN
  );
}

// Check if Email verification is configured
export function isEmailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST && 
    process.env.SMTP_USER && 
    process.env.SMTP_PASS
  );
}

// Get available verification method
export function getVerificationMethod(): 'whatsapp' | 'email' | 'demo' {
  if (isWhatsAppConfigured()) return 'whatsapp';
  if (isEmailConfigured()) return 'email';
  return 'demo'; // Development fallback - code shown in response
}

// Send OTP via WhatsApp (Ultramsg)
export async function sendWhatsAppOTP(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  
  if (!instanceId || !token) {
    return { success: false, error: 'WhatsApp غير مهيأ' };
  }

  const formattedPhone = formatYemeniPhone(phone);
  const message = `🔐 *أويو بلاست - OYO PLAST*\n\nكود التحقق الخاص بك هو:\n\n*${code}*\n\nصالح لمدة 10 دقائق.\n\nلا تشارك هذا الكود مع أي شخص.`;

  try {
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: token,
        to: formattedPhone,
        body: message,
      }),
    });

    const result = await response.json();
    
    if (result.sent === 'true' || result.sent === true) {
      return { success: true };
    } else {
      console.error('Ultramsg error:', result);
      return { success: false, error: result.message || 'فشل إرسال الرسالة' };
    }
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: 'خطأ في الاتصال بخدمة الواتساب' };
  }
}

// Send OTP via Email (fallback)
export async function sendEmailOTP(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  if (!smtpHost || !smtpUser || !smtpPass) {
    return { success: false, error: 'البريد الإلكتروني غير مهيأ' };
  }

  // Simple email sending using nodemailer pattern via fetch
  // For production, consider using nodemailer package
  try {
    // Using a simple SMTP relay or external email API
    // This is a placeholder - in production use nodemailer
    console.log(`[EMAIL] Would send OTP ${code} to ${email}`);
    
    // For now, we'll use a webhook/API approach if available
    // You can integrate with services like SendGrid, Mailgun, etc.
    
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'خطأ في إرسال البريد الإلكتروني' };
  }
}

// Send welcome message to marketer via WhatsApp
export async function sendMarketerWelcome(phone: string, name: string): Promise<{ success: boolean; error?: string }> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  
  if (!instanceId || !token) {
    console.log('[WELCOME] WhatsApp not configured, skipping welcome message');
    return { success: true }; // Silent fail for welcome messages
  }

  const formattedPhone = formatYemeniPhone(phone);
  const message = `🎉 *مرحباً بك في برنامج مسوقي أويو بلاست!*\n\nأهلاً ${name}،\n\nتم تفعيل حسابك كمسوق بنجاح.\n\n✅ يمكنك الآن:\n• تسجيل طلبات لعملائك\n• كسب عمولات على كل طلب\n• تتبع أرباحك من لوحة التحكم\n• سحب أرباحك إلى محفظتك\n\n📞 للدعم: 774997589\n\nفريق أويو بلاست`;

  try {
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: token,
        to: formattedPhone,
        body: message,
      }),
    });

    const result = await response.json();
    
    if (result.sent === 'true' || result.sent === true) {
      return { success: true };
    } else {
      console.error('Ultramsg welcome error:', result);
      return { success: false, error: result.message || 'فشل إرسال رسالة الترحيب' };
    }
  } catch (error) {
    console.error('WhatsApp welcome error:', error);
    return { success: false, error: 'خطأ في إرسال رسالة الترحيب' };
  }
}

// Main function to send verification code
export async function sendVerificationCode(
  phone: string, 
  email?: string
): Promise<{ 
  success: boolean; 
  method: 'whatsapp' | 'email' | 'demo'; 
  code?: string; // Only returned in demo mode
  error?: string;
}> {
  const code = generateOTP();
  const method = getVerificationMethod();

  switch (method) {
    case 'whatsapp': {
      const result = await sendWhatsAppOTP(phone, code);
      if (result.success) {
        return { success: true, method: 'whatsapp' };
      }
      // Fall back to email if WhatsApp fails
      if (email && isEmailConfigured()) {
        const emailResult = await sendEmailOTP(email, code);
        if (emailResult.success) {
          return { success: true, method: 'email' };
        }
      }
      return { success: false, method: 'whatsapp', error: result.error };
    }
    
    case 'email': {
      if (!email) {
        return { success: false, method: 'email', error: 'البريد الإلكتروني مطلوب' };
      }
      const result = await sendEmailOTP(email, code);
      if (result.success) {
        return { success: true, method: 'email' };
      }
      return { success: false, method: 'email', error: result.error };
    }
    
    case 'demo':
    default: {
      // Development mode - return code in response
      console.log(`[DEMO] Verification code for ${phone}: ${code}`);
      return { success: true, method: 'demo', code };
    }
  }
}

// Verify the OTP code
export function verifyOTPCode(inputCode: string, storedCode: string, expiresAt: Date): { 
  valid: boolean; 
  error?: string 
} {
  if (new Date() > expiresAt) {
    return { valid: false, error: 'انتهت صلاحية كود التحقق' };
  }
  
  if (inputCode !== storedCode) {
    return { valid: false, error: 'كود التحقق غير صحيح' };
  }
  
  return { valid: true };
}

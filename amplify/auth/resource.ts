export default {
  name: "auth",
  service: "Cognito",
  providerPlugin: "awscloudformation",
  type: "auth",
  options: {
    // Sign-in configuration: email only
    usernameAttributes: ["email"],
    signInAliases: {
      email: true,
      username: false,
      phone_number: false
    },
    // Auto-verify email addresses
    autoVerifiedAttributes: ["email"],
    // Required user attributes
    requiredAttributes: ["email"],
    // MFA and password policy
    mfaConfiguration: "OFF",
    passwordPolicy: {
      minimumLength: 8,
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: true,
      requireSymbols: false
    }
  }
} as const;

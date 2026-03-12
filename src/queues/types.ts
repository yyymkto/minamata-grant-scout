export type JobMessage =
  | {
      type: "user.welcome";
      payload: {
        userId: number;
        email: string;
        name: string;
        requestId: string;
      };
    }
  | {
      type: "upload.process";
      payload: {
        key: string;
        organizationId: number;
        size: number;
        contentType: string | null;
        requestId: string;
      };
    }
  | {
      type: "organization.invite_email";
      payload: {
        organizationId: number;
        organizationName: string;
        inviteId: number;
        email: string;
        role: string;
        inviteUrl: string;
        requestId: string;
      };
    }
  | {
      type: "auth.password_reset_email";
      payload: {
        userId: number;
        email: string;
        resetUrl: string;
        requestId: string;
      };
    }
  | {
      type: "auth.email_verification_email";
      payload: {
        userId: number;
        email: string;
        verifyUrl: string;
        requestId: string;
      };
    };

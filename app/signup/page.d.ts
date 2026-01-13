import React from 'react';
declare global {
    interface Window {
        grecaptcha: {
            enterprise: {
                execute: (sitekey: string, options: {
                    action: string;
                }) => Promise<string>;
            };
        };
        recaptchaToken: string;
    }
}
export default function SignupPage(): React.JSX.Element;
//# sourceMappingURL=page.d.ts.map
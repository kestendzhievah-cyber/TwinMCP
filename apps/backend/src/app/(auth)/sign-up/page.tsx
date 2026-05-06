import { Suspense } from "react";
import { SignUpForm } from "./form";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { PRODUCT } from "@/lib/demoPaths";
import SignupForm from "./SignupForm";

export const metadata: Metadata = { title: `Sign up · ${PRODUCT}` };

export default function Signup() {
  return (
    <div className="signup">
      <h1>Sign up</h1>
      <p className="muted">
        Tell us who you are and where you work. We&apos;ll set up your account for those cities and send you a sign-in
        code by email or text. No password, no card.
      </p>
      <SignupForm />
    </div>
  );
}

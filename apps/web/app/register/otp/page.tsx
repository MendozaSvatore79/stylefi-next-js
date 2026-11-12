import OtpClient from "./otp-client";

type SearchParams = {
  email?: string | string[];
};

export default async function RegisterOtpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialEmail = Array.isArray(params.email) ? params.email[0] ?? "" : params.email ?? "";

  return <OtpClient initialEmail={initialEmail} />;
}

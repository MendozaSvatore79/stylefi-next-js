import ResetPasswordClient from "./reset-password-client";

type SearchParams = {
  rid?: string | string[];
  token?: string | string[];
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rid = Array.isArray(params.rid) ? params.rid[0] ?? "" : params.rid ?? "";
  const token = Array.isArray(params.token) ? params.token[0] ?? "" : params.token ?? "";

  return <ResetPasswordClient resetId={rid} token={token} />;
}

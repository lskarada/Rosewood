import { redirect } from 'next/navigation';

export default async function SurveyRoot({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/survey/${token}/feed`);
}

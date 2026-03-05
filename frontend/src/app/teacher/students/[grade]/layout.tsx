export function generateStaticParams() {
  return [3, 4, 5, 6].map((grade) => ({
    grade: grade.toString(),
  }));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import AppShell from "@/components/app/AppShell";

export default function ChatLayout(props: { children: React.ReactNode }) {
  return <AppShell>{props.children}</AppShell>;
}


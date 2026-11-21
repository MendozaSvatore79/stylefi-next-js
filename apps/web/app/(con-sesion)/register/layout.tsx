import type { ReactNode } from "react";

type RegisterLayoutProps = {
	children: ReactNode;
};

export default function RegisterLayout({ children }: RegisterLayoutProps) {
	return <section>{children}</section>;
}

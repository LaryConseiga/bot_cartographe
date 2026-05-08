"use client";

import NextLink from "next/link";
import MuiLink, { LinkProps as MuiLinkProps } from "@mui/material/Link";

export default function AppLink(
  props: Omit<MuiLinkProps, "href" | "component"> & { href: string }
) {
  const { href, children, ...rest } = props;
  return (
    <MuiLink component={NextLink} href={href} {...rest}>
      {children}
    </MuiLink>
  );
}


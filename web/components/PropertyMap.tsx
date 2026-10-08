"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapProperty, MapPropertyInput } from "./PropertyMapInner";

const Inner = dynamic(() => import("./PropertyMapInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-xl" />,
});

export default function PropertyMap({
  properties,
  allProperties,
  label,
}: {
  properties: MapProperty[];
  allProperties: MapPropertyInput[];
  /** Accessible name for the map region. */
  label?: string;
}) {
  return <Inner properties={properties} allProperties={allProperties} label={label} />;
}

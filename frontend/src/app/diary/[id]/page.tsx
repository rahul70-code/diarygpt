import React from "react";
import Editor from "@/components/Editor";

export const dynamicParams = false;

// Static export helper: generates a client-side page bundle
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ params }: PageProps) {
  const { id } = await params;
  
  return <Editor id={id} />;
}

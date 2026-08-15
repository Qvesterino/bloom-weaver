import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Workspace } from "@/ui/Workspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Matter Field — Procedural 3D Motion Laboratory" },
      {
        name: "description",
        content:
          "Design luminous, organic, particle-based 3D motion in real time: emitters, force fields, gradient color engines, optics and seamless loop export.",
      },
      { property: "og:title", content: "Matter Field — Procedural 3D Motion Laboratory" },
      {
        property: "og:description",
        content:
          "A real-time WebGL laboratory for biomorphic particle visuals: fields, matter, optics and loop-perfect exports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="h-screen w-full bg-background" />}>
      <Workspace />
    </ClientOnly>
  );
}

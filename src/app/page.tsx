import { Button } from "@heroui/react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl font-semibold mb-6">DataPilot</h1>
      <Button variant="primary">Get Started</Button>
    </div>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col rounded-2xl content-center self-center p-5 gap-2 m-2">
      <div>
        <span className="text-4xl font-medium">Hatchet demo application</span>
      </div>
      <div className="self-center">
        <Link href="/person" className="bg-white gap-2 p-2 m-2 hover:bg-amber-600">
          Person
        </Link>
        <Link href="/profile" className="bg-white gap-2 p-2 m-2 hover:bg-amber-600">
          Profile
        </Link>
      </div>
    </div>
  );
}

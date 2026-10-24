import Image from "next/image";

export default function SchoolMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/school-mark.svg"
      alt="경북소프트웨어마이스터고등학교"
      width={size}
      height={size}
      priority
    />
  );
}

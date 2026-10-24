/**
 * 기숙사에서 접속할 때 서버에 보이는 IP를 아래 배열에 붙여 넣으세요.
 * 예: allowedNetworks: ["203.0.113.10"]
 * 여러 IP와 CIDR도 지원: ["203.0.113.10", "192.168.10.0/24"]
 * 인터넷 배포 시 기숙사 공유기의 공인 IP를 사용하세요.
 * 비어 있거나 잘못된 IP가 있으면 출석을 허용하지 않습니다.
 */
export const attendanceConfig = {
  allowedNetworks: ["172.28.10.29"] as string[],
  timeZone: "Asia/Seoul",
};

export function getAllowedNetworks() {
  return process.env.ATTENDANCE_ALLOWED_IPS === undefined
    ? attendanceConfig.allowedNetworks
    : process.env.ATTENDANCE_ALLOWED_IPS.split(/[\s,]+/).filter(Boolean);
}

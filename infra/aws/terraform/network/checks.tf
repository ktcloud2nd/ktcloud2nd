# 선언한 서브넷 개수가 설정한 가용 영역(AZ) 개수와 똑같은지를 테라폼이 실행될 때마다 자동으로 검사하는 코드

check "public_subnet_count_matches_azs" {
  assert {
    condition     = length(var.public_subnet_cidrs) == length(var.availability_zones)
    error_message = "Public subnet count must match the number of availability zones."
  }
}

check "private_app_subnet_count_matches_azs" {
  assert {
    condition     = length(var.private_app_subnet_cidrs) == length(var.availability_zones)
    error_message = "Private app subnet count must match the number of availability zones."
  }
}

check "db_subnet_count_matches_azs" {
  assert {
    condition     = length(var.db_subnet_cidrs) == length(var.availability_zones)
    error_message = "DB subnet count must match the number of availability zones."
  }
}
output "broker_public_ip" {
  description = "Broker VM에 접속하기 위한 공인 IP 주소"
  value       = azurerm_public_ip.broker_public_ip.ip_address
}

output "consumer_nat_public_ip" {
  description = "NAT 공인 IP 주소"
  value       = azurerm_public_ip.consumer_nat_ip.ip_address
}

output "admin_username" {
  description = "Broker VM에 접속하기 위한 관리자 계정명"
  value       = azurerm_linux_virtual_machine.broker_vm.admin_username # VM 리소스에서 직접 가져옴
}
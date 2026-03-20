# Broker Public IP
resource "azurerm_public_ip" "broker_ip" {
  name                = "broker-ip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard" # Static을 쓰려면 Standard SKU 필요
}

# Broker NIC
resource "azurerm_network_interface" "broker_nic" {
  name                = "broker-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.broker_subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.broker_ip.id
  }
}

# Broker VM 인스턴스
resource "azurerm_linux_virtual_machine" "broker_vm" {
  name                = "broker-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = "Standard_B1s" # 테스트라 일단 1로 함

  admin_username = "palja"

  network_interface_ids = [
    azurerm_network_interface.broker_nic.id
  ]

  zone = "1"

  admin_ssh_key {
    username   = "palja"
    public_key = file("~/.ssh/id_rsa.pub") # SSH 키 로그인
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS" # 가성비 SSD
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }
}

# DB용 Private DNS 영역 생성
resource "azurerm_private_dns_zone" "db_dns_zone" {
  name                = "palja.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name
}

# DNS 영역을 VNet에 연결
resource "azurerm_private_dns_zone_virtual_network_link" "db_dns_link" {
  name                  = "palja-dns-link"
  private_dns_zone_name = azurerm_private_dns_zone.db_dns_zone.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
  resource_group_name   = azurerm_resource_group.rg.name
}

# PostgreSQL Flexible Server 생성
resource "azurerm_postgresql_flexible_server" "pg_db" {
  name                   = "palja-pg-server"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "14"
  
  delegated_subnet_id    = azurerm_subnet.db_subnet.id 
  private_dns_zone_id    = azurerm_private_dns_zone.db_dns_zone.id

  public_network_access_enabled = false
  
  administrator_login    = "dbadmin"
  administrator_password = var.db_password
  
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"

  backup_retention_days  = 7 

  depends_on = [azurerm_private_dns_zone_virtual_network_link.db_dns_link]
}

# DB 생성
resource "azurerm_postgresql_flexible_server_database" "raw_db" {
  name      = "raw_db"
  server_id = azurerm_postgresql_flexible_server.pg_db.id
  collation = "en_US.utf8"
  charset   = "utf8"
}
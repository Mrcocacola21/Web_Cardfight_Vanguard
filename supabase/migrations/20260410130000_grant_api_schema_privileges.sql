grant usage on schema catalog to anon, authenticated, service_role;
grant usage on schema legality to anon, authenticated, service_role;
grant usage on schema importer to service_role;

grant select on all tables in schema catalog to anon, authenticated, service_role;
grant select on all tables in schema legality to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema importer to service_role;
grant select, insert, update, delete on all tables in schema catalog to service_role;
grant select, insert, update, delete on all tables in schema legality to service_role;

alter default privileges in schema catalog
  grant select on tables to anon, authenticated, service_role;
alter default privileges in schema legality
  grant select on tables to anon, authenticated, service_role;
alter default privileges in schema importer
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema catalog
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema legality
  grant select, insert, update, delete on tables to service_role;

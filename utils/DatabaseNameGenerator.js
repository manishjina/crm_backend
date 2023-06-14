function generateTenantDatabaseName(name, email) {
    const cleanedName = name.replace(/\s/g, '_').toLowerCase();
    const cleanedEmail = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const timestamp = Date.now().toString();
    const randomString = Math.random().toString(36).substring(2, 8);
  
    return `${cleanedName}_${cleanedEmail}_${timestamp}_${randomString}`;
  }
  module.exports={generateTenantDatabaseName}
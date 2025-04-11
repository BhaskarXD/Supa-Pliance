'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AutoFixContentProps {
  checkType: 'mfa' | 'rls' | 'pitr';
  projectId: string;
  isRunning: boolean;
  checkDetails?: any; // This will have the check details
  onExecute: (config: any) => Promise<void>;
}

export function AutoFixContent({
  checkType,
  projectId,
  isRunning,
  checkDetails,
  onExecute
}: AutoFixContentProps) {
  // State for configuration options
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [createDefaultPolicy, setCreateDefaultPolicy] = useState(true);
  const [retentionDays, setRetentionDays] = useState(7);
  const [parseError, setParseError] = useState<string | null>(null);
  const [usersWithoutMfa, setUsersWithoutMfa] = useState<any[]>([]);
  const [tablesWithoutRls, setTablesWithoutRls] = useState<any[]>([]);
  
  // Parse check details using useEffect to avoid render loops
  useEffect(() => {
    try {
      setParseError(null);
      setSelectedUsers([]); // Reset selections when check details change
      setSelectAll(false);
      
      if (!checkDetails || !checkDetails.details) {
        setUsersWithoutMfa([]);
        setTablesWithoutRls([]);
        return;
      }
      
      // Try to parse the details which might be a JSON string or already an object
      const parsedDetails = typeof checkDetails.details === 'string' 
        ? JSON.parse(checkDetails.details) 
        : checkDetails.details;
      console.log('Parsed details:', parsedDetails);
      
      // Log for debugging
      console.log('Parsing check details of type:', checkType);
      console.log('Parsed details structure:', parsedDetails);
      
      // Extract users without MFA from MFA check results
      if (checkType === 'mfa') {
        let users = [];
        // Handle multiple possible data structures
        if (parsedDetails.users) {
          users = parsedDetails.users
            .filter((u: any) => !u.mfa_enabled)
            .map((u: any) => ({
              id: u.id || u.user_id, // Handle different id field names
              email: u.email,
              mfa_enabled: u.mfa_enabled,
              last_login: u.last_sign_in || u.last_login
            }));
        } else if (parsedDetails.total_users && Array.isArray(parsedDetails.users_without_mfa)) {
          // Alternative structure with user IDs list
          users = parsedDetails.users_without_mfa || [];
        }
        console.log('Users without MFA:', users);
        setUsersWithoutMfa(users);
      }
      
      // Extract tables without RLS from RLS check results
      if (checkType === 'rls') {
        let tables = [];
        // Handle multiple possible data structures
        if (parsedDetails.tables) {
          tables = parsedDetails.tables
            .filter((t: any) => !t.rls_enabled && !t.has_rls) // Check both field names
            .map((t: any) => ({
              name: t.name || t.table_name, // Handle different field names
              schema: t.schema || 'public',
              rls_enabled: t.rls_enabled || t.has_rls,
              policy_count: t.policy_count || (t.policies ? t.policies.length : 0)
            }));
        } else if (parsedDetails.tables_without_rls) {
          tables = parsedDetails.tables_without_rls || [];
        }
        setTablesWithoutRls(tables);
      }
    } catch (error) {
      console.error('Error parsing check details:', error);
      setParseError('Failed to parse check details');
      setUsersWithoutMfa([]);
      setTablesWithoutRls([]);
    }
  }, [checkDetails, checkType]); // Only re-run when checkDetails or checkType changes
    
  // Handle select all checkbox changes
  const handleSelectAllChange = (checked: boolean) => {
    console.log('Select all changed to:', checked);
    setSelectAll(checked);
    
    if (checked) {
      // Select all users by email
      const userEmails = usersWithoutMfa
        .map((user: any) => {
          // Extract email as the identifier
          const email = typeof user === 'object' 
            ? user.email 
            : user;
          console.log('Mapped user email for select all:', email);
          return email;
        })
        .filter(Boolean);
      
      console.log('All user emails to select:', userEmails);
      setSelectedUsers(userEmails);
    } else {
      // Deselect all users
      setSelectedUsers([]);
    }
  };
  
  // Handle select all tables for RLS
  const handleSelectAllTablesChange = (checked: boolean) => {
    console.log('Select all tables changed to:', checked);
    
    if (checked) {
      // Select all tables by name
      const tableNames = tablesWithoutRls
        .map((table: any) => {
          // Extract table name
          return typeof table === 'object' 
            ? (table.name || table.table_name) 
            : table;
        })
        .filter(Boolean);
      
      console.log('All table names to select:', tableNames);
      setSelectedTables(tableNames);
    } else {
      // Deselect all tables
      setSelectedTables([]);
    }
  };
  
  // Toggle a user selection by email
  const toggleUserSelection = (userEmail: string) => {
    console.log('Toggle user selection called for email:', userEmail);
    
    // Check if user is already selected
    const isSelected = selectedUsers.includes(userEmail);
    console.log('User is currently selected:', isSelected);
    
    // Create a new array for immutability
    let newSelectedUsers: string[] = [];
    
    if (isSelected) {
      // If selected, remove from array
      newSelectedUsers = selectedUsers.filter(email => email !== userEmail);
      console.log('Removing user, new selection:', newSelectedUsers);
      
      // Always uncheck "select all" when any user is deselected
      setSelectAll(false);
    } else {
      // If not selected, add to array
      newSelectedUsers = [...selectedUsers, userEmail];
      console.log('Adding user, new selection:', newSelectedUsers);
      
      // Check if all users are now selected
      const allUserEmails = usersWithoutMfa
        .map(user => typeof user === 'object' ? user.email : user)
        .filter(Boolean);
      
      const allSelected = allUserEmails.length > 0 && 
        allUserEmails.every(email => newSelectedUsers.includes(email));
      
      console.log('All users selected?', allSelected, {allUserEmails, selectedCount: newSelectedUsers.length});
      
      // Update select all checkbox accordingly
      setSelectAll(allSelected);
    }
    
    // Update the selected users state
    setSelectedUsers(newSelectedUsers);
  };
  
  // Toggle a table selection
  const toggleTableSelection = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(name => name !== tableName)
        : [...prev, tableName]
    );
  };

  const handleExecute = () => {
    console.log('====== Execute Auto-Fix Called ======');
    let config = {};
    
    switch (checkType) {
      case 'mfa':
        // Map the selected user IDs to their actual email addresses
        const selectedEmails = selectedUsers.map(userId => {
          // Find the full user object for this ID
          const userObj = usersWithoutMfa.find(user => {
            if (typeof user === 'object') {
              return user.email === userId; // We're already storing emails
            }
            return user === userId;
          });
          
          // Return the email address (either from object or directly)
          if (typeof userObj === 'object' && userObj.email) {
            return userObj.email;
          }
          return userId; // If already an email, return as is
        });
        
        config = { 
          selectedUsers: selectedEmails,
          selectionType: 'email'
        };
        console.log('MFA config prepared:', config);
        console.log('Selected users (emails):', selectedEmails);
        break;
      case 'rls':
        config = { 
          // Tables could be objects or strings, so we're correctly passing the string names
          selectedTables,
          createDefaultPolicy
        };
        console.log('RLS config prepared:', config);
        break;
      case 'pitr':
        config = { retentionDays };
        console.log('PITR config prepared:', config);
        break;
    }
    
    console.log(`Executing ${checkType} fix with config:`, config);
    onExecute(config);
    console.log('===================================');
  };

  // Render configuration UI based on check type
  const renderConfig = () => {
    switch (checkType) {
      case 'mfa':
        return (
          <div className="space-y-4">
            {parseError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
            
            {usersWithoutMfa.length > 0 ? (
              <>
                <div className="flex items-start space-x-2 mb-4">
                  <Checkbox 
                    id="select-all-users" 
                    checked={selectAll}
                    onCheckedChange={handleSelectAllChange} 
                  />
                  <div>
                    <Label htmlFor="select-all-users">Select all users</Label>
                    <p className="text-sm text-muted-foreground">
                      Require MFA for all users listed below
                    </p>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Select</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[150px]">Last Login</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithoutMfa.map((user: any, index) => {
                      // Handle both object and string formats
                      const isObject = typeof user === 'object';
                      const userEmail = isObject ? user.email : user;
                      
                      // Log for debugging
                      console.log(`Rendering user row ${index}:`, { email: userEmail, selected: selectedUsers.includes(userEmail) });
                      
                      return (
                        <TableRow key={`user-row-${index}-${userEmail}`}>
                          <TableCell>
                            <Checkbox 
                              id={`user-checkbox-${index}`}
                              checked={selectedUsers.includes(userEmail)}
                              onCheckedChange={() => {
                                console.log(`Toggling user ${userEmail}`, { 
                                  was: selectedUsers.includes(userEmail), 
                                  will: !selectedUsers.includes(userEmail) 
                                });
                                toggleUserSelection(userEmail);
                              }}
                            />
                          </TableCell>
                          <TableCell>{userEmail}</TableCell>
                          <TableCell>
                            {isObject && user.last_login 
                              ? new Date(user.last_login).toLocaleDateString() 
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {selectedUsers.length === 0 && (
                  <div className="text-sm text-amber-600 mt-2">
                    Please select at least one user to enable MFA
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No users found without MFA enabled
              </div>
            )}
          </div>
        );
        
      case 'rls':
        return (
          <div className="space-y-4">
            {parseError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
            
            <div>
              <h3 className="text-sm font-medium mb-2">RLS Configuration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select tables to enable Row Level Security
              </p>
            </div>
            
            {tablesWithoutRls.length > 0 ? (
              <>
                <div className="flex items-start space-x-2 mb-4">
                  <Checkbox 
                    id="select-all-tables" 
                    checked={tablesWithoutRls.length > 0 && selectedTables.length === tablesWithoutRls.length}
                    onCheckedChange={handleSelectAllTablesChange}
                  />
                  <div>
                    <Label htmlFor="select-all-tables">Select all tables</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable RLS on all tables in this project
                    </p>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Select</TableHead>
                      <TableHead>Table Name</TableHead>
                      <TableHead className="w-[100px]">Policies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tablesWithoutRls.map((table: any, index) => {
                      // Handle both object and string formats
                      const isObject = typeof table === 'object';
                      const tableName = isObject ? (table.name || table.table_name) : table;
                      const policyCount = isObject ? (table.policy_count || 0) : 0;
                      
                      return (
                        <TableRow key={`table-row-${index}-${tableName}`}>
                          <TableCell>
                            <Checkbox 
                              id={`table-checkbox-${index}`}
                              checked={selectedTables.includes(tableName)}
                              onCheckedChange={() => toggleTableSelection(tableName)}
                            />
                          </TableCell>
                          <TableCell>{tableName}</TableCell>
                          <TableCell>{policyCount}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {selectedTables.length === 0 && (
                  <div className="text-sm text-amber-600 mt-2">
                    Please select at least one table to enable RLS
                  </div>
                )}
                
                <div className="flex items-start space-x-2 pt-4">
                  <Checkbox 
                    id="create-default-policy" 
                    checked={createDefaultPolicy}
                    onCheckedChange={(checked) => setCreateDefaultPolicy(!!checked)} 
                  />
                  <div>
                    <Label htmlFor="create-default-policy">Create default policy</Label>
                    <p className="text-sm text-muted-foreground">
                      Create a default policy that allows authenticated users to access data
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No tables found without RLS enabled
              </div>
            )}
          </div>
        );
        
      case 'pitr':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="retention-days">Retention Period (Days)</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input 
                  id="retention-days"
                  type="number" 
                  min={1} 
                  max={30}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(parseInt(e.target.value) || 7)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This setting may require database superuser privileges to apply
              </p>
            </div>
          </div>
        );
    }
  };

  // Determine if the execute button should be disabled
  const isExecuteDisabled = isRunning || 
    (checkType === 'mfa' && selectedUsers.length === 0) ||
    (checkType === 'rls' && selectedTables.length === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {checkType === 'mfa' && 'Multi-Factor Authentication (MFA)'}
          {checkType === 'rls' && 'Row Level Security (RLS)'}
          {checkType === 'pitr' && 'Point in Time Recovery (PITR)'}
        </CardTitle>
        <CardDescription>
          {checkType === 'mfa' && 'Enable MFA for selected users in your Supabase project'}
          {checkType === 'rls' && 'Enable row level security on selected tables'}
          {checkType === 'pitr' && 'Configure point in time recovery settings'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderConfig()}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button 
          onClick={handleExecute} 
          disabled={isExecuteDisabled}
        >
          {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isRunning ? "Applying..." : "Apply Fix"}
        </Button>
      </CardFooter>
    </Card>
  );
}
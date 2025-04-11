import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface CheckResultsProps {
  check: {
    id: string;
    type: 'mfa' | 'rls' | 'pitr';
    status: string;
    result: boolean | null;
    details: string | null;
  };
}

export function CheckResults({ check }: CheckResultsProps) {
  const getStatusIcon = (status: string, result: boolean | null) => {
    if (status !== 'completed') return <AlertCircle className="h-4 w-4" />;
    return result ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const renderMFAResults = (details: any) => {
    if (!details) return null;
    const data = JSON.parse(details);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Total Users</TableCell>
            <TableCell>{data.total_users}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Users with MFA</TableCell>
            <TableCell>{data.users_with_mfa || (data.total_users - data.users_without_mfa)}</TableCell>
          </TableRow>
          {data.users_without_mfa > 0 && (
            <TableRow>
              <TableCell>Users without MFA</TableCell>
              <TableCell className="text-red-500">
                {data.users_without_mfa} ({data.user_emails?.join(', ')})
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };

  const renderRLSResults = (details: any) => {
    if (!details) return null;
    const data = JSON.parse(details);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Total Tables</TableCell>
            <TableCell>{data.total_tables}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Tables with RLS</TableCell>
            <TableCell>{data.total_tables - data.tables_without_rls.length}</TableCell>
          </TableRow>
          {data.tables_without_rls.length > 0 && (
            <TableRow>
              <TableCell>Tables without RLS</TableCell>
              <TableCell className="text-red-500">
                {data.tables_without_rls.join(', ')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };

  const renderPITRResults = (details: any) => {
    if (!details) return null;
    const data = JSON.parse(details);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Setting</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(data.settings || {}).map(([key, value]) => (
            <TableRow key={key}>
              <TableCell>{key}</TableCell>
              <TableCell>{value as string}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>PITR Status</TableCell>
            <TableCell>
              <Badge variant={data.pitr_enabled ? 'default' : 'destructive'}>
                {data.pitr_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };

  const renderResults = () => {
    if (!check.details) return null;
    
    switch (check.type) {
      case 'mfa':
        return renderMFAResults(check.details);
      case 'rls':
        return renderRLSResults(check.details);
      case 'pitr':
        return renderPITRResults(check.details);
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(check.status, check.result)}
          <h3 className="font-medium capitalize">{check.type} Check Results</h3>
        </div>
        <Badge variant={check.status === 'completed' ? (check.result ? 'default' : 'destructive') : 'secondary'}>
          {check.status === 'completed' ? (check.result ? 'Pass' : 'Fail') : check.status}
        </Badge>
      </div>
      {renderResults()}
    </div>
  );
} 
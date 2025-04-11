import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/utils/supabase-admin";

// Define OpenAI API types
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
}

// Expanded context interface
interface AIChatContext {
  projectName?: string;
  checkType?: 'mfa' | 'rls' | 'pitr';
  checkStatus?: string;
  checkResult?: boolean;
  currentCheckId?: string | null;
  projectId?: string | null;
  // Recent chat history
  chatHistory?: Array<{
    role: string;
    content: string;
  }>;
  currentScan?: {
    timestamp: string;
    status: string;
    checks: Array<{
      type: 'mfa' | 'rls' | 'pitr';
      status: string;
      result: boolean | null;
      details: any;
    }>;
  };
  scanHistory?: Array<{
    timestamp: string;
    status: string;
    checks: Array<{
      type: 'mfa' | 'rls' | 'pitr';
      status: string;
      result: boolean | null;
    }>;
  }>;
  projectContext?: {
    currentScan: {
      timestamp: string;
      status: string;
      checks: Array<{
        type: 'mfa' | 'rls' | 'pitr';
        status: string;
        result: boolean | null;
        details: any;
      }>;
    } | null;
    scanHistory: Array<{
      scanIndex: number;
      timestamp: string;
      formattedDate: string;
      status: string;
      isCurrentlyViewed: boolean;
      checks: Array<{
        type: 'mfa' | 'rls' | 'pitr';
        status: string;
        result: boolean | null;
      }>;
      summary: {
        totalChecks: number;
        passed: number;
        failed: number;
        pending: number;
      };
    }>;
  };
}


// Fetch project data and compliance checks from the database
async function fetchProjectData(projectId: string, currentCheckId: string | null) {
  const supabase = await getSupabaseAdmin();
  
  try {
    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      console.error('Error fetching project:', projectError);
      throw projectError;
    }
    
    // Fetch all compliance checks for this project 
    const { data: checks, error: checksError } = await supabase
      .from('compliance_checks')
      .select(`
        id, 
        type, 
        status, 
        result, 
        details, 
        timestamp,
        evidence (
          id,
          type,
          content,
          severity,
          timestamp,
          metadata
        )
      `)
      .eq('project_id', projectId)
      .order('timestamp', { ascending: false });
    
    if (checksError) {
      console.error('Error fetching checks:', checksError);
      throw checksError;
    }
    
    // Group checks by timestamp (scan group)
    const scanGroups = checks.reduce((groups: any, check: any) => {
      // Extract date part of timestamp for grouping
      const timestamp = check.timestamp.split('.')[0];
      if (!groups[timestamp]) {
        groups[timestamp] = [];
      }
      groups[timestamp].push(check);
      return groups;
    }, {});
    
    // Convert to array and sort by timestamp (newest to oldest)
    const scans = Object.entries(scanGroups)
      .map(([timestamp, checksGroup]: [string, any]) => ({
        timestamp,
        formattedDate: new Date(timestamp).toLocaleString(),
        checks: checksGroup,
        status: checksGroup.every((c: any) => c.status === 'completed')
          ? checksGroup.some((c: any) => c.result === false) ? 'failed' : 'completed'
          : 'running' 
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Find current scan and check
    let currentScan = null;
    let currentCheck = null;
    
    if (currentCheckId) {
      // Find the scan containing this check
      for (const scan of scans) {
        const found = scan.checks.find((c: any) => c.id === currentCheckId);
        if (found) {
          currentScan = scan;
          currentCheck = found;
          break;
        }
      }
    } else if (scans.length > 0) {
      // Default to most recent scan if no checkId provided
      currentScan = scans[0];
    }
    
    return {
      project,
      scans,
      currentScan,
      currentCheck
    };
  } catch (error) {
    console.error('Error fetching project data:', error);
    throw error;
  }
}

/**
 * Create a system prompt for Supabase compliance topics
 */
function getSystemPrompt(context?: AIChatContext): string {
  let basePrompt = `You are an expert on Supabase database security and compliance. 
Your role is to help users understand and fix compliance issues with their Supabase projects.
Provide clear, accurate, and actionable advice. Be concise but thorough.`;

  // Add specific guidance based on check type
  if (context?.checkType === 'mfa') {
    basePrompt += `
You specialize in Multi-Factor Authentication (MFA) for Supabase.
Focus on explaining how MFA works in Supabase, how to enable it, best practices, and troubleshooting common issues.
Include specific code examples when appropriate using the Supabase JS client or SQL commands.`;
  } else if (context?.checkType === 'rls') {
    basePrompt += `
You specialize in Row Level Security (RLS) for Supabase PostgreSQL databases.
Focus on explaining how RLS works, how to create policies, common patterns, and debugging techniques.
Include specific SQL examples for creating and testing RLS policies.`;
  } else if (context?.checkType === 'pitr') {
    basePrompt += `
You specialize in Point-in-Time Recovery (PITR) for Supabase.
Focus on explaining how PITR works, how to enable it, best practices for backup strategies, and recovery procedures.
Include specific instructions on setting up PITR through the Supabase dashboard or API.`;
  }

  return basePrompt;
}

/**
 * Call the OpenAI API
 */
async function callOpenAI(messages: OpenAIMessage[]): Promise<string> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // Log messages being sent to OpenAI for debugging
    console.log('===== SENDING TO OPENAI: =====');
    console.log(JSON.stringify(messages, null, 2));
    console.log('==============================');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as OpenAICompletionResponse;
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Format project data for AI context
 */
function formatProjectContext(project: any, scans: any[], currentScan: any, currentCheck: any) {
  if (!project || !scans || !scans.length) {
    return null;
  }
  
  // Format current scan
  const formattedCurrentScan = currentScan ? {
    timestamp: currentScan.timestamp,
    status: currentScan.status,
    checks: currentScan.checks.map((check: any) => ({
      type: check.type,
      status: check.status,
      result: check.result,
      details: check.details ? JSON.parse(check.details) : null,
      // Include evidence if available
      ...(check.evidence ? { evidence: check.evidence } : {})
    }))
  } : null;
  
  // Format scan history (chronologically, oldest to newest)
  const formattedScanHistory = [...scans]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((scan, index) => {
      // Calculate summary statistics for the scan
      const totalChecks = scan.checks.length;
      const passedChecks = scan.checks.filter((c: any) => c.result === true).length;
      const failedChecks = scan.checks.filter((c: any) => c.result === false).length;
      const pendingChecks = scan.checks.filter((c: any) => c.result === null).length;
      
      return {
        scanIndex: index + 1,
        timestamp: scan.timestamp,
        formattedDate: scan.formattedDate,
        status: scan.status,
        isCurrentlyViewed: currentScan && scan.timestamp === currentScan.timestamp,
        // Include all check results for each scan
        checks: scan.checks.map((check: any) => ({
          type: check.type,
          status: check.status,
          result: check.result
        })),
        // Summary statistics
        summary: {
          totalChecks,
          passed: passedChecks,
          failed: failedChecks,
          pending: pendingChecks
        }
      };
    });
  
  return {
    currentScan: formattedCurrentScan,
    scanHistory: formattedScanHistory
  };
}

/**
 * Format the comprehensive context into a detailed message
 */
function formatDetailedContext(context: AIChatContext): string {
  let contextMessage = '';
  
  // Format the enhanced project context if available (preferred format)
  if (context.projectContext) {
    if (context.projectName) {
      contextMessage += `# Project: ${context.projectName}\n\n`;
    }

    // Format scan history in chronological order (oldest to newest)
    if (context.projectContext.scanHistory && context.projectContext.scanHistory.length > 0) {
      contextMessage += `## Complete Scan History (${context.projectContext.scanHistory.length} scans)\n\n`;
      
      // Create a summary table of all scans
      contextMessage += `| Scan # | Date | Status | Passed | Failed | Pending | Currently Viewing |\n`;
      contextMessage += `|:-------|:-----|:-------|:-------|:-------|:--------|:-----------------|\n`;
      
      context.projectContext.scanHistory.forEach(scan => {
        contextMessage += `| Scan ${scan.scanIndex} | ${scan.formattedDate} | ${scan.status.toUpperCase()} | ${scan.summary.passed} | ${scan.summary.failed} | ${scan.summary.pending} | ${scan.isCurrentlyViewed ? '✓' : ''} |\n`;
      });
      
      contextMessage += `\n\n`;
      
      // Detailed information about each scan
      contextMessage += `## Individual Scan Details\n\n`;
      
      context.projectContext.scanHistory.forEach(scan => {
        contextMessage += `### Scan ${scan.scanIndex}: ${scan.formattedDate}\n`;
        contextMessage += `- Status: ${scan.status.toUpperCase()}\n`;
        contextMessage += `- ${scan.isCurrentlyViewed ? '**CURRENTLY VIEWING THIS SCAN**' : ''}\n\n`;
        
        // List check results
        contextMessage += `#### Check Results\n`;
        ['mfa', 'rls', 'pitr'].forEach(checkType => {
          const check = scan.checks.find(c => c.type === checkType);
          if (check) {
            contextMessage += `- ${checkType.toUpperCase()}: ${check.status === 'completed' ? (check.result ? '✅ PASSED' : '❌ FAILED') : '⏳ ' + check.status.toUpperCase()}\n`;
          } else {
            contextMessage += `- ${checkType.toUpperCase()}: Not checked\n`;
          }
        });
        
        contextMessage += `\n`;
      });
      
      // Add details about the current scan being viewed
      if (context.projectContext.currentScan) {
        const currentScan = context.projectContext.currentScan;
        contextMessage += `## Current Scan Details (User is viewing this)\n`;
        contextMessage += `- Timestamp: ${new Date(currentScan.timestamp).toLocaleString()}\n`;
        contextMessage += `- Status: ${currentScan.status.toUpperCase()}\n\n`;
        
        // Detailed information about each check
        contextMessage += `### Technical Details\n\n`;
        currentScan.checks.forEach(check => {
          contextMessage += `#### ${check.type.toUpperCase()} Check Details\n`;
          contextMessage += `- Status: ${check.status}\n`;
          contextMessage += `- Result: ${check.result === null ? 'PENDING' : check.result ? 'PASSED' : 'FAILED'}\n`;
          
          // Limit details size if too large
          if (check.details) {
            const detailsStr = typeof check.details === 'string' 
              ? check.details 
              : JSON.stringify(check.details, null, 2);
            
            // Truncate if too large (>1000 chars)
            const truncatedDetails = detailsStr.length > 1000 
              ? detailsStr.substring(0, 1000) + '... [truncated due to size]' 
              : detailsStr;
            
            contextMessage += `- Technical Data:\n\`\`\`json\n${truncatedDetails}\n\`\`\`\n\n`;
          }
          
          // Include evidence logs if available
          if ((check as any).evidence && (check as any).evidence.length > 0) {
            contextMessage += `#### Evidence Logs\n`;
            
            // Get evidence logs, sort by severity (error > warning > info)
            const severityOrder: Record<string, number> = { 'error': 0, 'warning': 1, 'info': 2 };
            const sortedEvidence = [...(check as any).evidence].sort((a, b) => {
              // First sort by severity
              const aSeverity = a.severity as string;
              const bSeverity = b.severity as string;
              const severityDiff = (severityOrder[aSeverity] ?? 3) - (severityOrder[bSeverity] ?? 3);
              if (severityDiff !== 0) return severityDiff;
              // Then by timestamp (newest first)
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
            
            // Limit to 5 most important logs
            const limitedEvidence = sortedEvidence.slice(0, 5);
            
            // Show count if truncated
            if (sortedEvidence.length > 5) {
              contextMessage += `_Showing 5 most important logs out of ${sortedEvidence.length} total_\n\n`;
            }
            
            limitedEvidence.forEach((log: any, i: number) => {
              // Truncate content if too large (>200 chars)
              const content = log.content.length > 200 
                ? log.content.substring(0, 200) + '... [truncated]' 
                : log.content;
              
              contextMessage += `${i+1}. **${log.severity.toUpperCase()}**: ${content}\n`;
              
              if (log.metadata) {
                try {
                  const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
                  
                  // For metadata, extract only key fields or summarize
                  const metadataStr = JSON.stringify(metadata, null, 2);
                  
                  // If metadata is too large, summarize it or truncate
                  if (metadataStr.length > 300) {
                    // Extract just the keys if it's an object
                    if (typeof metadata === 'object' && metadata !== null) {
                      const keys = Object.keys(metadata);
                      contextMessage += `   Details: Contains ${keys.length} fields: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}\n`;
                    } else {
                      // Otherwise just truncate
                      contextMessage += `   Details: ${metadataStr.substring(0, 300)}... [truncated]\n`;
                    }
                  } else {
                    contextMessage += `   Details: \`\`\`json\n${metadataStr}\n\`\`\`\n`;
                  }
                } catch (e) {
                  // If parsing fails, truncate if needed
                  const metadataStr = typeof log.metadata === 'string' ? log.metadata : String(log.metadata);
                  contextMessage += `   Details: ${metadataStr.length > 200 ? metadataStr.substring(0, 200) + '... [truncated]' : metadataStr}\n`;
                }
              }
              contextMessage += `   _Time: ${new Date(log.timestamp).toLocaleString()}_\n\n`;
            });
            
            // If there are more logs, add a note
            if (sortedEvidence.length > 5) {
              contextMessage += `_${sortedEvidence.length - 5} additional logs not shown_\n\n`;
            }
          }
        });
      }
      
      return contextMessage;
    }
  }
  
  // Basic project info
  if (context.projectName) {
    contextMessage += `## Project: ${context.projectName}\n\n`;
  }
  
  // Current scan details (comprehensive)
  if (context.currentScan) {
    contextMessage += `## Current Scan Details\n`;
    contextMessage += `- Timestamp: ${new Date(context.currentScan.timestamp).toLocaleString()}\n`;
    contextMessage += `- Status: ${context.currentScan.status.toUpperCase()}\n\n`;
    
    // Detailed check information
    contextMessage += `### Checks in Current Scan\n`;
    for (const check of context.currentScan.checks) {
      contextMessage += `#### ${check.type.toUpperCase()} Check\n`;
      contextMessage += `- Status: ${check.status}\n`;
      contextMessage += `- Result: ${check.result === null ? 'PENDING' : check.result ? 'PASSED' : 'FAILED'}\n`;
      
      // Include parsed details if available
      if (check.details) {
        // Limit details size if too large
        const detailsStr = typeof check.details === 'string' 
          ? check.details 
          : JSON.stringify(check.details, null, 2);
        
        // Truncate if too large (>1000 chars)
        const truncatedDetails = detailsStr.length > 1000 
          ? detailsStr.substring(0, 1000) + '... [truncated due to size]' 
          : detailsStr;
        
        contextMessage += `- Details:\n\`\`\`json\n${truncatedDetails}\n\`\`\`\n`;
      }
      contextMessage += '\n';
    }
  }
  
  // Scan history (more concise)
  if (context.scanHistory && context.scanHistory.length > 0) {
    contextMessage += `## Scan History (Last ${context.scanHistory.length} Scans)\n\n`;
    
    context.scanHistory.forEach((scan, index) => {
      contextMessage += `### Scan ${index + 1} - ${new Date(scan.timestamp).toLocaleString()}\n`;
      contextMessage += `- Status: ${scan.status.toUpperCase()}\n`;
      
      // Summary of check results
      const passedChecks = scan.checks.filter((c: any) => c.result === true).length;
      const failedChecks = scan.checks.filter((c: any) => c.result === false).length;
      const pendingChecks = scan.checks.filter((c: any) => c.result === null).length;
      
      contextMessage += `- Summary: ${passedChecks} passed, ${failedChecks} failed, ${pendingChecks} pending\n`;
      
      // Brief check details
      contextMessage += `- Checks:\n`;
      for (const check of scan.checks) {
        contextMessage += `  - ${check.type.toUpperCase()}: ${check.result === null ? 'PENDING' : check.result ? 'PASSED' : 'FAILED'}\n`;
      }
      contextMessage += '\n';
    });
  }
  
  return contextMessage;
}

export async function POST(request: Request) {
  try {
    const { message, context } = await request.json();
    
    // Basic validation
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message parameter' },
        { status: 400 }
      );
    }
    
    // Enhanced context: if we have checkId and projectId, fetch data from database
    let enhancedContext = {...context};
    
    if (context.currentCheckId && context.projectId) {
      try {
        const { project, scans, currentScan, currentCheck } = await fetchProjectData(
          context.projectId,
          context.currentCheckId
        );
        
        // Set up enhanced context with data from database
        enhancedContext = {
          ...context,
          projectName: context.projectName || project?.name,
          checkType: currentCheck?.type || context.checkType,
          projectContext: formatProjectContext(project, scans, currentScan, currentCheck)
        };
      } catch (error) {
        console.error('Error enhancing context with database data:', error);
        // Continue with original context if database fetch fails
      }
    }
    
    // Prepare messages for OpenAI
    const messages: OpenAIMessage[] = [
      { 
        role: 'system', 
        content: getSystemPrompt(enhancedContext) 
      }
    ];

    // Generate detailed context if we have it
    if (enhancedContext.projectContext || enhancedContext.currentScan || enhancedContext.scanHistory) {
      const detailedContext = formatDetailedContext(enhancedContext);
      if (detailedContext) {
        messages.push({ 
          role: 'system', 
          content: `Here is detailed information about the current state of the project:\n\n${detailedContext}\n\nUse this information to provide relevant, contextual answers to the user's questions.` 
        });
      }
    }
    // For backward compatibility, also include simple context if that's all we have
    else if (enhancedContext) {
      let simpleContextMessage = '';
      if (enhancedContext.projectName) {
        simpleContextMessage += `Project: ${enhancedContext.projectName}\n`;
      }
      
      if (enhancedContext.checkType) {
        simpleContextMessage += `Check Type: ${enhancedContext.checkType.toUpperCase()}\n`;
        
        if (enhancedContext.checkStatus) {
          simpleContextMessage += `Status: ${enhancedContext.checkStatus}\n`;
          
          if (enhancedContext.checkStatus === 'completed') {
            simpleContextMessage += `Result: ${enhancedContext.checkResult ? 'PASSED' : 'FAILED'}\n`;
          }
        }
      }
      
      if (simpleContextMessage) {
        messages.push({ 
          role: 'system', 
          content: `Context information about the user's environment:\n${simpleContextMessage}` 
        });
      }
    }

    // Include recent conversation history if available
    if (enhancedContext.chatHistory && enhancedContext.chatHistory.length > 0) {
      // Add a system message explaining this is previous conversation context
      messages.push({
        role: 'system',
        content: 'Below is the recent conversation history for context:'
      });
      
      // Add each message from the chat history
      enhancedContext.chatHistory.forEach((msg: { role: string; content: string }) => {
        // Ensure role is valid for OpenAI (system, user, or assistant)
        const role = ['system', 'user', 'assistant'].includes(msg.role) 
          ? msg.role as 'system' | 'user' | 'assistant'
          : 'user'; // Default to user if unknown role
        
        messages.push({
          role,
          content: msg.content
        });
      });
    }

    // Add user message
    messages.push({ role: 'user', content: message });

    // Log the final message structure being sent to OpenAI for debugging
    console.log('Sending to OpenAI:', JSON.stringify({
      messages: messages.map(m => ({
        role: m.role,
        content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
      }))
    }, null, 2));

    // Get response from OpenAI
    const content = await callOpenAI(messages);
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error in AI chat API:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
} 
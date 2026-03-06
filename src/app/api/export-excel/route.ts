import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';

interface ExtractedPolicy {
  name: string;
  found: boolean;
  summary: string;
  details: string;
  conditions?: string[];
  refoundText?: string;
}

interface ExtractionResult {
  cancellationPolicies: ExtractedPolicy[];
  paymentPolicies: ExtractedPolicy[];
  generalTerms?: string;
  companyName?: string;
  lastUpdated?: string;
  modelUsed: string;
  attempts: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { result, url, scrapedInfo } = body as {
      result: ExtractionResult;
      url: string;
      scrapedInfo?: { title: string; contentLength: number; pagesScraped: number };
    };

    if (!result) {
      return NextResponse.json({ error: 'No result provided' }, { status: 400 });
    }

    // Create Python script for Excel generation
    const pythonScript = `
import sys
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Read input data
input_data = json.loads(sys.argv[1])
result = input_data['result']
url = input_data['url']
scraped_info = input_data.get('scrapedInfo', {})

# Create workbook
wb = Workbook()

# Style definitions
header_font = Font(name='Times New Roman', size=12, bold=True, color='FFFFFF')
header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
title_font = Font(name='Times New Roman', size=18, bold=True, color='1F4E79')
subheading_font = Font(name='Times New Roman', size=12, bold=True, color='333333')
body_font = Font(name='Times New Roman', size=11, color='000000')
found_font = Font(name='Times New Roman', size=11, color='008000')
not_found_font = Font(name='Times New Roman', size=11, color='999999')
thin_border = Border(
    left=Side(style='thin', color='CCCCCC'),
    right=Side(style='thin', color='CCCCCC'),
    top=Side(style='thin', color='CCCCCC'),
    bottom=Side(style='thin', color='CCCCCC')
)

# Sheet 1: Summary
ws_summary = wb.active
ws_summary.title = 'Summary'

# Title
ws_summary['B2'] = 'Policy Extraction Report'
ws_summary['B2'].font = title_font
ws_summary['B2'].alignment = Alignment(horizontal='left')

# Metadata
row = 4
ws_summary[f'B{row}'] = 'Company Name:'
ws_summary[f'C{row}'] = result.get('companyName', 'Unknown')
ws_summary[f'B{row}'].font = subheading_font
ws_summary[f'C{row}'].font = body_font

row += 1
ws_summary[f'B{row}'] = 'Source URL:'
ws_summary[f'C{row}'] = url
ws_summary[f'B{row}'].font = subheading_font
ws_summary[f'C{row}'].font = body_font

row += 1
ws_summary[f'B{row}'] = 'Model Used:'
ws_summary[f'C{row}'] = result.get('modelUsed', 'N/A')
ws_summary[f'B{row}'].font = subheading_font
ws_summary[f'C{row}'].font = body_font

row += 1
ws_summary[f'B{row}'] = 'Extraction Attempts:'
ws_summary[f'C{row}'] = result.get('attempts', 1)
ws_summary[f'B{row}'].font = subheading_font
ws_summary[f'C{row}'].font = body_font

# Statistics
row += 2
found_cancellation = len([p for p in result['cancellationPolicies'] if p.get('found')])
found_payment = len([p for p in result['paymentPolicies'] if p.get('found')])

ws_summary[f'B{row}'] = 'Cancellation Policies Found:'
ws_summary[f'C{row}'] = f'{found_cancellation}/13'
ws_summary[f'B{row}'].font = subheading_font
ws_summary[f'C{row}'].font = body_font

row += 1
ws_summary[f'B{row}'] = 'Payment Policies Found:'
ws_summary[f'C{row}'] = f'{found_payment}/8'
ws_summary[f'B{row}'].font = subheading_font
ws_summary[f'C{row}'].font = body_font

# Set column widths
ws_summary.column_dimensions['B'].width = 25
ws_summary.column_dimensions['C'].width = 50

# Sheet 2: Cancellation Policies
ws_cancel = wb.create_sheet('Cancellation Policies')

# Headers
headers = ['Policy Name', 'Status', 'Summary', 'Details', 'Conditions']
for col, header in enumerate(headers, 2):
    cell = ws_cancel.cell(row=2, column=col, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal='center', vertical='center')
    cell.border = thin_border

# Data
row = 3
for policy in result['cancellationPolicies']:
    status = 'Found' if policy.get('found') else 'Not Found'
    conditions = ', '.join(policy.get('conditions', []))
    
    ws_cancel.cell(row=row, column=2, value=policy['name']).font = body_font
    ws_cancel.cell(row=row, column=3, value=status).font = found_font if policy.get('found') else not_found_font
    ws_cancel.cell(row=row, column=4, value=policy.get('summary', '')).font = body_font
    ws_cancel.cell(row=row, column=5, value=policy.get('details', '')).font = body_font
    ws_cancel.cell(row=row, column=6, value=conditions).font = body_font
    
    for col in range(2, 7):
        ws_cancel.cell(row=row, column=col).border = thin_border
        ws_cancel.cell(row=row, column=col).alignment = Alignment(vertical='top', wrap_text=True)
    
    row += 1

# Set column widths
ws_cancel.column_dimensions['B'].width = 35
ws_cancel.column_dimensions['C'].width = 12
ws_cancel.column_dimensions['D'].width = 40
ws_cancel.column_dimensions['E'].width = 60
ws_cancel.column_dimensions['F'].width = 30

# Sheet 3: Payment Policies
ws_payment = wb.create_sheet('Payment Policies')

# Headers
for col, header in enumerate(headers, 2):
    cell = ws_payment.cell(row=2, column=col, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal='center', vertical='center')
    cell.border = thin_border

# Data
row = 3
for policy in result['paymentPolicies']:
    status = 'Found' if policy.get('found') else 'Not Found'
    conditions = ', '.join(policy.get('conditions', []))
    
    ws_payment.cell(row=row, column=2, value=policy['name']).font = body_font
    ws_payment.cell(row=row, column=3, value=status).font = found_font if policy.get('found') else not_found_font
    ws_payment.cell(row=row, column=4, value=policy.get('summary', '')).font = body_font
    ws_payment.cell(row=row, column=5, value=policy.get('details', '')).font = body_font
    ws_payment.cell(row=row, column=6, value=conditions).font = body_font
    
    for col in range(2, 7):
        ws_payment.cell(row=row, column=col).border = thin_border
        ws_payment.cell(row=row, column=col).alignment = Alignment(vertical='top', wrap_text=True)
    
    row += 1

# Set column widths
ws_payment.column_dimensions['B'].width = 30
ws_payment.column_dimensions['C'].width = 12
ws_payment.column_dimensions['D'].width = 40
ws_payment.column_dimensions['E'].width = 60
ws_payment.column_dimensions['F'].width = 30

# Sheet 4: General Terms
if result.get('generalTerms'):
    ws_terms = wb.create_sheet('General Terms')
    ws_terms['B2'] = 'General Terms'
    ws_terms['B2'].font = title_font
    ws_terms['B3'] = result['generalTerms']
    ws_terms['B3'].font = body_font
    ws_terms['B3'].alignment = Alignment(wrap_text=True, vertical='top')
    ws_terms.column_dimensions['B'].width = 100
    ws_terms.row_dimensions[3].height = 200

# Save
output_path = '/home/z/my-project/download/policy_report.xlsx'
wb.save(output_path)
print(output_path)
`;

    // Write Python script to temp file
    const scriptPath = '/tmp/generate_excel.py';
    fs.writeFileSync(scriptPath, pythonScript);

    // Execute Python script
    const inputData = JSON.stringify({ result, url, scrapedInfo });
    
    await new Promise<string>((resolve, reject) => {
      const process = spawn('python3', [scriptPath, inputData]);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });
    });

    // Read the generated Excel file
    const excelPath = '/home/z/my-project/download/policy_report.xlsx';
    const excelBuffer = fs.readFileSync(excelPath);

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="policy_report.xlsx"',
      },
    });

  } catch (error) {
    console.error('Excel generation error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to generate Excel' },
      { status: 500 }
    );
  }
}

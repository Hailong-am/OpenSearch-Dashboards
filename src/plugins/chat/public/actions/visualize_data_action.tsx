/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { EuiPanel, EuiText, EuiLoadingChart } from '@elastic/eui';
import { useAssistantAction } from '../../../context_provider/public';
import { HttpSetup } from '../../../../core/public';

interface VisualizeDataArgs {
  query: string;
  queryType: 'ppl' | 'dsl';
  index?: string;
  chartType?: 'bar' | 'line' | 'pie';
  title?: string;
  xField?: string;
  yField?: string;
  datasourceId?: string;
}

type ChartData = Array<Record<string, any>>;

const parsePPLResponse = (response: any): ChartData => {
  if (!response?.schema || !response?.datarows) return [];
  const fields = response.schema.map((s: any) => s.name);
  return response.datarows.map((row: any[]) => {
    const obj: Record<string, any> = {};
    fields.forEach((f: string, i: number) => {
      obj[f] = row[i];
    });
    return obj;
  });
};

const parseDSLResponse = (response: any): ChartData => {
  const aggs = response?.aggregations;
  if (aggs) {
    // Find the first aggregation bucket
    const aggKey = Object.keys(aggs).find((k) => aggs[k]?.buckets);
    if (aggKey) {
      return aggs[aggKey].buckets.map((b: any) => {
        const row: Record<string, any> = { key: b.key_as_string || b.key, doc_count: b.doc_count };
        // Include sub-aggregation values
        Object.keys(b).forEach((k) => {
          if (b[k]?.value !== undefined) row[k] = b[k].value;
        });
        return row;
      });
    }
  }
  // Fallback to hits
  return (response?.hits?.hits || []).map((h: any) => h._source || {});
};

const EChartsRenderer: React.FC<{ data: ChartData; args: VisualizeDataArgs }> = ({
  data,
  args,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    const chart = echarts.init(chartRef.current);
    const { chartType = 'bar', title } = args;

    const keys = Object.keys(data[0]);
    const x = args.xField || keys.find((k) => typeof data[0][k] === 'string') || keys[0];
    const y =
      args.yField ||
      keys.find((k) => k !== x && typeof data[0][k] === 'number') ||
      keys.find((k) => k !== x) ||
      keys[1];

    const xData = data.map((d) => d[x]);
    const yData = data.map((d) => (typeof d[y!] === 'number' ? d[y!] : Number(d[y!]) || 0));

    const option: echarts.EChartsOption =
      chartType === 'pie'
        ? {
            title: title ? { text: title, left: 'center' } : undefined,
            tooltip: { trigger: 'item' },
            series: [
              {
                type: 'pie',
                data: data.map((d) => ({
                  name: d[x],
                  value: typeof d[y!] === 'number' ? d[y!] : Number(d[y!]) || 0,
                })),
              },
            ],
          }
        : {
            title: title ? { text: title, left: 'center' } : undefined,
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: xData },
            yAxis: { type: 'value' },
            series: [{ type: chartType, data: yData }],
          };

    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [data, args]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
};

const MAX_LLM_ROWS = 10;

export function useVisualizeDataAction(http: HttpSetup, enabled: boolean = true) {
  useAssistantAction<VisualizeDataArgs>({
    name: 'visualize_data',
    description:
      'Execute a query against OpenSearch and render the results as a chart. Supports PPL and DSL queries. For DSL with aggregations, the aggregation buckets are automatically extracted and visualized.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The query to execute. For PPL: e.g. "source=my_index | stats count() by status". For DSL: a JSON string of the search body.',
        },
        queryType: {
          type: 'string',
          description: 'Query language: "ppl" or "dsl".',
        },
        index: {
          type: 'string',
          description:
            'Index name. Required for DSL queries, optional for PPL (index is in the query).',
        },
        chartType: {
          type: 'string',
          description: 'Chart type: bar, line, or pie. Defaults to bar.',
        },
        title: {
          type: 'string',
          description: 'Optional chart title.',
        },
        xField: {
          type: 'string',
          description: 'Field name for x-axis. Auto-detected if omitted.',
        },
        yField: {
          type: 'string',
          description: 'Field name for y-axis. Auto-detected if omitted.',
        },
      },
      required: ['query', 'queryType'],
    },
    handler: async (args) => {
      try {
        let response: any;
        const dsQuery = args.datasourceId ? { dataSourceId: args.datasourceId } : {};
        if (args.queryType === 'ppl') {
          response = await http.post('/api/console/proxy', {
            query: { path: '/_plugins/_ppl', method: 'POST', ...dsQuery },
            body: JSON.stringify({ query: args.query }),
          });
          const data = parsePPLResponse(response);
          if (!data.length) return { success: false, error: 'Query returned no results' };
          return {
            success: true,
            totalRows: data.length,
            preview: data.slice(0, MAX_LLM_ROWS),
            data,
          };
        } else {
          const index = args.index;
          if (!index) return { success: false, error: 'index is required for DSL queries' };
          const body = typeof args.query === 'string' ? args.query : JSON.stringify(args.query);
          response = await http.post('/api/console/proxy', {
            query: { path: `/${index}/_search`, method: 'POST', ...dsQuery },
            body,
          });
          const data = parseDSLResponse(response);
          if (!data.length) return { success: false, error: 'Query returned no results' };
          return {
            success: true,
            totalRows: data.length,
            preview: data.slice(0, MAX_LLM_ROWS),
            data,
          };
        }
      } catch (e: any) {
        return { success: false, error: e.message || 'Query execution failed' };
      }
    },
    render: ({ status, args, result }) => {
      if (status === 'executing') {
        return (
          <EuiPanel paddingSize="s">
            <EuiLoadingChart size="l" />
          </EuiPanel>
        );
      }
      if (status === 'failed' || (result && !result.success)) {
        return (
          <EuiPanel paddingSize="s" color="danger">
            <EuiText size="s">{result?.error || 'Failed to render chart'}</EuiText>
          </EuiPanel>
        );
      }
      if (status === 'complete' && result?.success && result?.data?.length && args) {
        return (
          <EuiPanel paddingSize="s">
            <EChartsRenderer data={result.data} args={args} />
          </EuiPanel>
        );
      }
      return null;
    },
    enabled,
    useCustomRenderer: true,
  });
}

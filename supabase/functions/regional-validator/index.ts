import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RegionalConfig {
  region: string;
  binanceEndpoint: string;
  spotEnabled: boolean;
  futuresEnabled: boolean;
  restrictions: string[];
  status: 'full' | 'partial' | 'restricted';
}

interface CompatibilityReport {
  region: string;
  countryCode: string;
  compatibility: {
    status: RegionalConfig['status'];
    spotTrading: boolean;
    futuresTrading: boolean;
    arbitrageCapable: boolean;
  };
  configuration: {
    endpoint: string;
    connectivity: boolean;
    restrictions: string[];
  };
  recommendations: string[];
}

class RegionalValidator {
  private regionalConfigs: Map<string, RegionalConfig> = new Map([
    ['BR', {
      region: 'Brazil',
      binanceEndpoint: 'https://api.binance.com',
      spotEnabled: true,
      futuresEnabled: true,
      restrictions: [],
      status: 'full'
    }],
    ['US', {
      region: 'United States',
      binanceEndpoint: 'https://api.binance.us',
      spotEnabled: true,
      futuresEnabled: false,
      restrictions: ['No futures trading', 'Limited pairs'],
      status: 'partial'
    }],
    ['CN', {
      region: 'China',
      binanceEndpoint: '',
      spotEnabled: false,
      futuresEnabled: false,
      restrictions: ['Binance not available'],
      status: 'restricted'
    }],
    ['EU', {
      region: 'European Union',
      binanceEndpoint: 'https://api.binance.com',
      spotEnabled: true,
      futuresEnabled: true,
      restrictions: [],
      status: 'full'
    }],
    ['DEFAULT', {
      region: 'International',
      binanceEndpoint: 'https://api.binance.com',
      spotEnabled: true,
      futuresEnabled: true,
      restrictions: [],
      status: 'full'
    }]
  ]);

  async detectUserRegion(request: Request): Promise<string> {
    const cfCountry = request.headers.get('CF-IPCountry');
    if (cfCountry) {
      return cfCountry;
    }

    try {
      const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]
        || request.headers.get('x-real-ip')
        || 'unknown';
      
      if (clientIP !== 'unknown') {
        const response = await fetch(`http://ip-api.com/json/${clientIP}`);
        const data = await response.json();
        return data.countryCode || 'DEFAULT';
      }
    } catch (error) {
      console.log('Erro na detec??o de regi?o:', error);
    }

    return 'DEFAULT';
  }

  getRegionalConfig(countryCode: string): RegionalConfig {
    const mapping: { [key: string]: string } = {
      'US': 'US',
      'CN': 'CN',
      'HK': 'CN',
      'BR': 'BR',
      'DE': 'EU', 'FR': 'EU', 'IT': 'EU', 'ES': 'EU', 'NL': 'EU',
    };

    const configKey = mapping[countryCode] || 'DEFAULT';
    return this.regionalConfigs.get(configKey) || this.regionalConfigs.get('DEFAULT')!;
  }

  async validateBinanceConnectivity(endpoint: string): Promise<boolean> {
    if (!endpoint) return false;

    try {
      const response = await fetch(`${endpoint}/api/v3/ping`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Synapse Trading Bot'
        }
      });
      return response.ok;
    } catch (error) {
      console.log('Erro na conectividade Binance:', error);
      return false;
    }
  }

  async generateCompatibilityReport(countryCode: string): Promise<CompatibilityReport> {
    const config = this.getRegionalConfig(countryCode);
    const connectivity = await this.validateBinanceConnectivity(config.binanceEndpoint);

    return {
      region: config.region,
      countryCode,
      compatibility: {
        status: config.status,
        spotTrading: config.spotEnabled && connectivity,
        futuresTrading: config.futuresEnabled && connectivity,
        arbitrageCapable: config.spotEnabled && config.futuresEnabled && connectivity
      },
      configuration: {
        endpoint: config.binanceEndpoint,
        connectivity,
        restrictions: config.restrictions
      },
      recommendations: this.generateRecommendations(config, connectivity)
    };
  }

  private generateRecommendations(config: RegionalConfig, connectivity: boolean): string[] {
    const recommendations: string[] = [];

    if (config.status === 'restricted') {
      recommendations.push('Considere usar VPN para acessar Binance');
      recommendations.push('Explore exchanges locais alternativos');
    } else if (config.status === 'partial') {
      recommendations.push('Trading limitado apenas ao spot market');
      recommendations.push('Arbitragem spot-futures n?o dispon?vel');
    } else if (!connectivity) {
      recommendations.push('Verifique sua conex?o com a internet');
      recommendations.push('Configure whitelist de IP na Binance');
    } else {
      recommendations.push('Sistema totalmente compat?vel');
      recommendations.push('Todas as funcionalidades dispon?veis');
    }

    return recommendations;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validator = new RegionalValidator();
    
    if (req.method === 'POST') {
      const { action, countryCode } = await req.json();

      switch (action) {
        case 'detect_region': {
          const detectedRegion = await validator.detectUserRegion(req);
          const report = await validator.generateCompatibilityReport(detectedRegion);
          
          return new Response(JSON.stringify({
            success: true,
            detectedRegion,
            report
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }

        case 'validate_region': {
          if (!countryCode) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Country code required'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          }

          const report = await validator.generateCompatibilityReport(countryCode);
          
          return new Response(JSON.stringify({
            success: true,
            report
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }

        default:
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid action'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Method not allowed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405
    });

  } catch (error) {
    console.error('Erro no validador regional:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

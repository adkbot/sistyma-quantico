import React from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Settings } from "lucide-react";

interface HeroSectionProps {
  isRunning: boolean;
  onToggleBot: () => void;
  onStopBot: () => void;
  onOpenSettings: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  isRunning,
  onToggleBot,
  onStopBot,
  onOpenSettings,
}) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          width="100%"
          height="100%"
          autoPlay
          muted
          loop
          playsInline
          style={{objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: -1}}
        >
          <source src="URL_DO_SEU_VIDEO.mp4" type="video/mp4" />
          Seu navegador não suporta a tag de vídeo.
        </video>
        {/* Faça o upload do seu vídeo para um serviço de hospedagem e substitua URL_DO_SEU_VIDEO.mp4 */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-6xl mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-6xl md:text-8xl font-bold mb-6 text-quantum">
            SYNAPSE
          </h1>
          <h2 className="text-3xl md:text-5xl font-light mb-4 text-neural">
            ARBITRAGE
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Sistema de Trading Quântico Adaptativo para Arbitragem de Alta Frequência
          </p>
        </div>

        {/* Status Indicator */}
        <div className="mb-12">
          <div className={`inline-flex items-center px-6 py-3 rounded-full glass-card ${
            isRunning ? 'status-active' : ''
          }`}>
            <div className={`w-3 h-3 rounded-full mr-3 ${
              isRunning ? 'bg-accent animate-pulse' : 'bg-muted-foreground'
            }`} />
            <span className="text-lg font-medium">
              {isRunning ? 'Sistema Ativo - Monitorando Mercados' : 'Sistema Inativo'}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <Button
            onClick={onToggleBot}
            size="lg"
            className={`px-8 py-4 text-lg ${
              isRunning ? 'btn-neural' : 'btn-quantum'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="mr-2 h-5 w-5" />
                Pausar Sistema
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Iniciar Sistema
              </>
            )}
          </Button>

          <Button
            onClick={onStopBot}
            size="lg"
            variant="destructive"
            className="px-8 py-4 text-lg"
            disabled={!isRunning}
          >
            <Square className="mr-2 h-5 w-5" />
            Parar Sistema
          </Button>

          <Button
            onClick={onOpenSettings}
            size="lg"
            className="btn-cyber px-8 py-4 text-lg"
          >
            <Settings className="mr-2 h-5 w-5" />
            Configurações
          </Button>
        </div>

        {/* Neural Network Visualization */}
        <div className="mt-16 opacity-60">
          <div className="flex justify-center items-center space-x-8">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full bg-primary/40"
                style={{
                  animation: `quantum-pulse ${2 + i * 0.3}s infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `quantum-pulse ${3 + Math.random() * 2}s infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
export const examples = [
  { id: 'hola', title: 'Hola, mundo tranquilo', subtitle: 'Variables · bucles · descansos', badge: '01', code: `# Trabajar sí. Quemarse, no.
pilas 12;

pon nombre = "mundo";
chiva "Hola, " + nombre + " ☀";

repite 3 {
  chiva "Vuelta " + turno + ": sin prisa.";
  siesta;
}

chiva "Hecho. Me voy a la hamaca.";` },
  { id: 'recetas', title: 'La cuenta del café', subtitle: 'Recetas · argumentos · retorno', badge: '02', code: `# Las funciones aquí se cocinan.
receta cuenta(cafes, precio) {
  pon subtotal = cafes * precio;
  sirve redondea(subtotal * 1.1);
}

pon total = cuenta(3, 2);
chiva "Con propina: " + total + " €";

si total < 10 {
  chiva "Invito yo. Pero solo hoy.";
} sino {
  chiva "Mejor lo dividimos.";
}` },
  { id: 'fizz', title: 'FizzBuzz de sobremesa', subtitle: 'Condiciones · módulo · lógica', badge: '03', code: `pilas 20;

repite 15 {
  si turno % 3 == 0 y turno % 5 == 0 {
    chiva "FizzSiesta";
  } sino {
    si turno % 3 == 0 {
      chiva "Fizz";
    } sino {
      si turno % 5 == 0 {
        chiva "Siesta";
      } sino {
        chiva turno;
      }
    }
  }
  siesta;
}` },
  { id: 'lista', title: 'La lista de la compra', subtitle: 'Listas · índices · mientras', badge: '04', code: `pon compra = ["café", "pan", "una hamaca"];
pon i = 0;

mientras i < largo(compra) {
  chiva "□ " + compra[i];
  i = i + 1;
  siesta;
}

chiva "Prioridades claras.";` },
  { id: 'bateria', title: 'Sin pilas no hay paraíso', subtitle: 'Un error que puedes arreglar', badge: '05', code: `# Este programa se queda sin energía.
# Arréglalo añadiendo siesta; en el bucle.
pilas 6;

repite 5 {
  chiva "Estoy currando: " + turno;
}

chiva "¡He llegado!";` },
  { id: 'fibo', title: 'Fibonacci en zapatillas', subtitle: 'Estado · secuencias · energía', badge: '06', code: `pilas 16;
pon a = 0;
pon b = 1;

repite 12 {
  chiva a;
  pon siguiente = a + b;
  a = b;
  b = siguiente;
  siesta;
}` }
];

#!/usr/bin/perl
# Builds data/kb.json for JALTRON's offline knowledge pack.
# Run from the repo root: perl tools/build-kb.pl
use strict;
use warnings;
use utf8;
use JSON::PP;
use File::Basename qw(dirname);
use File::Path qw(make_path);

my $root = dirname(dirname(__FILE__));
my $out  = "$root/data/kb.json";
make_path("$root/data");
my $JSON = JSON::PP->new->utf8->canonical;
my (@entries, %alias, %src);

# keep whatever an earlier run produced (also survives a network outage)
if (-e $out) {
  open my $pf, '<:raw', $out or die "cannot read $out: $!";
  local $/;
  my $old = eval { $JSON->decode(<$pf>) };
  close $pf;
  for my $e (@{ ($old && $old->{e}) || [] }) {
    next unless ref $e eq 'ARRAY' && ref $e->[0] eq 'ARRAY';
    my $s = $e->[2] || '';
    next if $s && $src{$s}++;    # one entry per source
    my @q = grep { !$alias{lc $_}++ } @{ $e->[0] };
    next unless @q;
    push @entries, [\@q, $e->[1], $s];
  }
}

sub fetch {
  my ($url, $t) = @_;
  $t ||= 40;
  my $body = `curl -fsSL --max-time $t -A "JaltronKB/1.0 (knowledge pack builder)" "$url" 2>/dev/null`;
  return $body;
}
sub urlenc {
  my $s = shift;
  my $b = $s;
  utf8::encode($b);
  $b =~ s/([^A-Za-z0-9_.~-])/sprintf('%%%02X', ord($1))/ge;
  return $b;
}
sub wurl {
  my $t = shift;
  $t =~ s/ /_/g;
  return 'https://en.wikipedia.org/wiki/' . urlenc($t);
}
sub commify {
  my $n = shift;
  1 while $n =~ s/^(\d+)(\d{3})/$1,$2/;
  return $n;
}
sub trim {
  my ($text, $max) = @_;
  $text =~ s/\([^)]{0,80}\)\s*//g;
  $text =~ s/\s+/ /g;
  $text =~ s/^\s+|\s+$//g;
  my @s = split /(?<=[.!?])\s+/, $text;
  my ($out, $n) = ('', 0);
  for my $s (@s) {
    next if $s =~ /^\s*[\[(]/;
    last if $n >= 3;
    last if length($out) + length($s) + 1 > $max;
    $out .= ($out ? ' ' : '') . $s;
    $n++;
  }
  $out = substr($out, 0, $max) unless length($out) <= $max;
  return $out;
}
sub add {
  my ($aliases, $answer, $source) = @_;
  my (@q, %seen);
  for my $a (@$aliases) {
    next unless defined $a && length($a) >= 3 && length($a) <= 70;
    my $k = lc $a;
    next if $seen{$k}++ || $alias{$k};
    push @q, $a;
  }
  return unless @q && length($answer) >= 20;
  return if $source && $src{$source}++;
  $alias{$_} = 1 for map { lc } @q;
  push @entries, [\@q, substr($answer, 0, 900), $source];
}

# ---- countries (mledoze/countries) ----
my $cj = fetch('https://raw.githubusercontent.com/mledoze/countries/master/countries.json');
my $countries = eval { JSON::PP->new->utf8->decode($cj) } || [];
for my $c (@$countries) {
  my $name = $c->{name}{common} or next;
  my @a = ($name);
  push @a, $c->{name}{official} if $c->{name}{official} && $c->{name}{official} ne $name && length($c->{name}{official}) <= 60;
  my $n = 0;
  for my $sp (@{ $c->{altSpellings} || [] }) {
    next if $n >= 3 || !defined $sp || length($sp) < 4 || length($sp) > 60 || $sp =~ /\d/;
    push @a, $sp;
    $n++;
  }
  my @bits;
  my $cap = join(', ', @{ $c->{capital} || [] });
  push @bits, "capital $cap" if $cap;
  push @bits, 'area ' . commify($c->{area}) . ' km²' if $c->{area};
  my @cur = map { ($c->{currencies}{$_}{name} || $_) . " ($_)" } sort keys %{ $c->{currencies} || {} };
  push @bits, 'currency ' . join(', ', @cur) if @cur;
  my @lang = map { $c->{languages}{$_} } sort keys %{ $c->{languages} || {} };
  push @bits, 'languages ' . join(', ', @lang) if @lang;
  my $region = $c->{subregion} || $c->{region} || '';
  push @bits, "region $region" if $region;
  next unless @bits;
  add(\@a, "$name: " . join('; ', @bits) . '.', wurl($name));
}

# ---- chemical elements ----
my $ej = fetch('https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json');
my $elements = eval { JSON::PP->new->utf8->decode($ej)->{elements} } || [];
for my $e (@$elements) {
  my $name = $e->{name} or next;
  my $sum = trim($e->{summary} || '', 520);
  my $head = "$name ($e->{symbol}, atomic number $e->{number}";
  $head .= ', atomic mass ' . $e->{atomic_mass} if defined $e->{atomic_mass};
  $head .= ')';
  my $answer = $sum ? "$head: $sum" : "$head is a chemical element.";
  add([$name, "$name element"], $answer, wurl($name));
}

# ---- US state capitals ----
my %states = (
  Alabama => 'Montgomery', Alaska => 'Juneau', Arizona => 'Phoenix', Arkansas => 'Little Rock',
  California => 'Sacramento', Colorado => 'Denver', Connecticut => 'Hartford', Delaware => 'Dover',
  Florida => 'Tallahassee', Georgia => 'Atlanta', Hawaii => 'Honolulu', Idaho => 'Boise',
  Illinois => 'Springfield', Indiana => 'Indianapolis', Iowa => 'Des Moines', Kansas => 'Topeka',
  Kentucky => 'Frankfort', Louisiana => 'Baton Rouge', Maine => 'Augusta', Maryland => 'Annapolis',
  Massachusetts => 'Boston', Michigan => 'Lansing', Minnesota => 'Saint Paul', Mississippi => 'Jackson',
  Missouri => 'Jefferson City', Montana => 'Helena', Nebraska => 'Lincoln', Nevada => 'Carson City',
  'New Hampshire' => 'Concord', 'New Jersey' => 'Trenton', 'New Mexico' => 'Santa Fe', 'New York' => 'Albany',
  'North Carolina' => 'Raleigh', 'North Dakota' => 'Bismarck', Ohio => 'Columbus', Oklahoma => 'Oklahoma City',
  Oregon => 'Salem', Pennsylvania => 'Harrisburg', 'Rhode Island' => 'Providence', 'South Carolina' => 'Columbia',
  'South Dakota' => 'Pierre', Tennessee => 'Nashville', Texas => 'Austin', Utah => 'Salt Lake City',
  Vermont => 'Montpelier', Virginia => 'Richmond', Washington => 'Olympia', 'West Virginia' => 'Charleston',
  Wisconsin => 'Madison', Wyoming => 'Cheyenne'
);
for my $s (sort keys %states) {
  add([$s, "$s state", "$s US state"], "$s (US state): capital $states{$s}.", wurl($s));
}

# ---- general topics from Wikipedia ----
my @topics = qw(
  Moon Sun Earth Mars Jupiter Saturn Venus Uranus Neptune Mercury_(planet) Solar_System
  Black_hole Gravity Photosynthesis Evolution DNA Neuron Brain Heart Blood Immune_system
  Vitamin_C Protein Carbohydrate Atom Electron Proton Neutron Molecule Water Carbon_dioxide
  Nitrogen Diamond Internet World_Wide_Web Computer Central_processing_unit Algorithm
  Artificial_intelligence Machine_learning Neural_network Cryptography Blockchain Bitcoin
  Quantum_mechanics Theory_of_relativity Speed_of_light Thermodynamics Electricity Magnetism
  Electromagnetic_radiation Nuclear_fission Nuclear_fusion Periodic_table Milky_Way Universe
  Big_Bang Star Planet Asteroid Comet Earthquake Volcano Tsunami Tropical_cyclone Climate
  Greenhouse_effect Global_warming Ozone_layer Water_cycle Rain Snow Rainbow Lightning Thunder
  Tornado Desert Rainforest Coral_reef Ecosystem Food_chain Cell Bacteria Virus Fungus Plant
  Bird Fish Insect Mammal Dinosaur Human Language Writing Printing Book Library Democracy
  Capitalism Socialism Communism United_Nations European_Union Roman_Empire Ancient_Egypt
  World_War_I World_War_II Cold_War Renaissance Industrial_Revolution Telephone Television
  Radio Airplane Car Train Solar_energy Wind_power Nuclear_power Fossil_fuel Renewable_energy
  Recycling Plastic Steel Concrete Glass Paper Coffee Tea Chocolate Bread Rice Banana Apple
  Honey Milk Wine Beer Sugar Salt Pepper Telescope Microscope Photography Music Painting
  Architecture Mathematics Physics Chemistry Biology Astronomy Geology Psychology Philosophy
  Economics Law Medicine Vaccine Antibiotic Cancer Diabetes Asthma Heart_disease Malaria
  Influenza COVID-19 Sleep Dream Memory Emotion Happiness Meditation Exercise Nutrition
  Obesity Smoking Alcohol Caffeine Sugar_substitute Artificial_intelligence
);
my %seen_topic;
my @want = grep { !$seen_topic{lc $_}++ } map { my $x = $_; $x =~ s/_/ /g; $x } @topics;
my $fails = 0;
for my $title (@want) {
  last if $fails >= 4;    # Wikipedia is rate-limiting this IP; stop poking it
  my $u = 'https://en.wikipedia.org/api/rest_v1/page/summary/' . urlenc($title);
  my $body = fetch($u, 8);
  if ($body !~ /^\s*\{/) { $fails++; next; }
  my $j = eval { JSON::PP->new->utf8->decode($body) } or next;
  next unless ($j->{type} || '') eq 'standard' && $j->{extract};
  my $text = trim($j->{extract}, 620);
  next unless length($text) >= 80;
  $fails = 0;
  my $short = $title;
  $short =~ s/ \(.+//;
  add([$title, $short], $text, $j->{content_urls}{desktop}{page} || wurl($title));
  select(undef, undef, undef, 0.2);
}

# ---- curated topics: always available, even when Wikipedia rate-limits the builder ----
# q{title}, q{alias}, q{answer}; source is the matching Wikipedia article.
my @curated = (
  ['Moon', 'the Moon', q{The Moon is Earth's only natural satellite, about 384,400 km away. It is tidally locked, so the same side always faces Earth, and its gravity drives ocean tides. It formed about 4.5 billion years ago from debris after a Mars-sized body struck Earth.}],
  ['Sun', 'the Sun', q{The Sun is the star at the center of the Solar System, a G-type main-sequence star about 4.6 billion years old. It holds 99.86% of the system's mass and fuses hydrogen into helium in its core, releasing the light and heat that sustain life on Earth.}],
  ['Earth', undef, q{Earth is the third planet from the Sun and the only place known to host life. It is about 4.54 billion years old, 71% covered by water, and protected by a magnetic field and an oxygen-rich atmosphere.}],
  ['Mars', undef, q{Mars is the fourth planet from the Sun, called the Red Planet because of iron oxide dust. It has a thin carbon dioxide atmosphere, the largest volcano in the Solar System (Olympus Mons), and two small moons, Phobos and Deimos.}],
  ['Jupiter', undef, q{Jupiter is the largest planet in the Solar System, a gas giant more than twice as massive as all other planets combined. Its Great Red Spot is a giant storm, and it has dozens of moons, including Europa and Ganymede.}],
  ['Saturn', undef, q{Saturn is the sixth planet, a gas giant famous for its bright rings of ice and rock. It is the least dense planet and has more than 140 known moons, including Titan, which has a thick atmosphere.}],
  ['Solar System', undef, q{The Solar System consists of the Sun and the objects bound to it: eight planets, dwarf planets, moons, asteroids and comets. It formed about 4.6 billion years ago from a collapsing cloud of gas and dust.}],
  ['Black hole', undef, q{A black hole is a region of space where gravity is so strong that nothing, not even light, can escape. Stellar black holes form when massive stars collapse; supermassive black holes sit at the centers of galaxies. The first image of one was released in 2019.}],
  ['Gravity', undef, q{Gravity is the attraction between objects with mass. Newton described it as a force decreasing with the square of distance; Einstein's general relativity explains it as the curvature of spacetime caused by mass and energy.}],
  ['Galaxy', undef, q{A galaxy is a gravitationally bound system of stars, gas, dust and dark matter. They range from dwarf galaxies with millions of stars to giant ellipticals with trillions, and most have a central black hole.}],
  ['Milky Way', 'the Milky Way', q{The Milky Way is the barred spiral galaxy containing the Solar System. It spans about 100,000 light-years and holds an estimated 100–400 billion stars, with the Sun located in the Orion Arm.}],
  ['Universe', 'the Universe', q{The universe is all of space, time, matter and energy. It is about 13.8 billion years old and is expanding, so distant galaxies move away from one another.}],
  ['Big Bang', 'the Big Bang', q{The Big Bang is the prevailing model for the origin of the universe: space expanded from an extremely hot, dense state about 13.8 billion years ago. The cosmic microwave background is its leftover radiation.}],
  ['Light', undef, q{Light is electromagnetic radiation visible to the human eye, with wavelengths from about 380 to 750 nanometres. It travels at 299,792,458 metres per second in a vacuum and behaves as both a wave and a particle.}],
  ['Sound', undef, q{Sound is a pressure wave travelling through a medium such as air, water or solid material. Humans hear frequencies from about 20 Hz to 20 kHz, and sound cannot travel through a vacuum.}],
  ['Speed of light', undef, q{The speed of light in a vacuum is exactly 299,792,458 metres per second (about 300,000 km/s), denoted c. It is the universal speed limit for information and mass, and light slows down in materials such as glass or water.}],
  ['Quantum mechanics', undef, q{Quantum mechanics describes matter and energy at atomic and subatomic scales. Particles have wave-like properties, energy is quantised, and quantities such as position and momentum are subject to the uncertainty principle.}],
  ['Theory of relativity', 'relativity', q{Einstein's theory of relativity has two parts. Special relativity (1905) says the speed of light is constant and gives E = mc²; general relativity (1915) describes gravity as the curvature of spacetime.}],
  ['Atom', undef, q{An atom is the smallest unit of a chemical element that retains its properties. It has a nucleus of protons and neutrons surrounded by electrons, and atoms bond to form molecules.}],
  ['Electron', undef, q{An electron is a negatively charged subatomic particle with a mass about 1/1836 that of a proton. It surrounds atomic nuclei in orbitals, and the flow of electrons produces electric current.}],
  ['Molecule', undef, q{A molecule is a group of atoms held together by chemical bonds. Water (H₂O), oxygen (O₂) and carbon dioxide (CO₂) are simple examples; proteins and DNA are very large molecules.}],
  ['Water', undef, q{Water is a chemical compound of hydrogen and oxygen (H₂O). It is polar, dissolves many substances, covers about 71% of Earth's surface, and is essential for known life.}],
  ['Carbon dioxide', 'CO2', q{Carbon dioxide (CO₂) is a colourless gas produced by respiration, combustion and decomposition. Plants absorb it for photosynthesis, and it is a major greenhouse gas.}],
  ['Oxygen', undef, q{Oxygen is a chemical element with symbol O and atomic number 8. Molecular oxygen (O₂) makes up about 21% of Earth's atmosphere and is required for respiration in most living things.}],
  ['Photosynthesis', undef, q{Photosynthesis is how plants, algae and some bacteria convert light energy into chemical energy. Using chlorophyll, they combine carbon dioxide and water to make glucose and release oxygen.}],
  ['Evolution', undef, q{Evolution is the change in inherited traits of populations over generations. Natural selection, described by Darwin and Wallace, favours traits that improve survival and reproduction.}],
  ['DNA', undef, q{DNA (deoxyribonucleic acid) is the molecule that carries genetic instructions in living things. Its double helix of paired bases (A–T, G–C) was described in 1953; the human genome has about 3 billion base pairs.}],
  ['Cell', 'cells', q{The cell is the basic structural and functional unit of life. Prokaryotic cells lack a nucleus, while eukaryotic cells contain organelles, including a nucleus and mitochondria.}],
  ['Neuron', 'neurons', q{A neuron is an electrically excitable cell that transmits nerve impulses. It has dendrites that receive signals, an axon that carries them, and synapses that connect to other cells; the human brain has about 86 billion.}],
  ['Brain', undef, q{The brain is the central organ of the nervous system. In humans it contains about 86 billion neurons and controls movement, senses, memory, emotion and thought.}],
  ['Heart', undef, q{The heart is a muscular organ that pumps blood through the circulatory system. In humans it has four chambers and beats roughly 100,000 times a day.}],
  ['Blood', undef, q{Blood is a fluid connective tissue that carries oxygen, nutrients, hormones and waste. It consists of plasma, red cells, white cells and platelets; red cells use haemoglobin to transport oxygen.}],
  ['Immune system', undef, q{The immune system is the body's defence against pathogens. It has innate defences such as skin and inflammation, plus adaptive responses using antibodies and memory cells; vaccines train this memory.}],
  ['Virus', 'viruses', q{A virus is an infectious agent made of genetic material inside a protein coat. It cannot reproduce on its own and must hijack a host cell; examples include influenza, HIV and SARS-CoV-2.}],
  ['Bacteria', 'bacterium', q{Bacteria are single-celled organisms without a nucleus. They are found almost everywhere, play key roles in digestion and nutrient cycles, and some cause disease; antibiotics target them, not viruses.}],
  ['Dinosaur', 'dinosaurs', q{Dinosaurs were reptiles that dominated land during the Mesozoic era. They went extinct about 66 million years ago after an asteroid impact, except for birds, which evolved from them.}],
  ['Human', 'humans', q{Humans (Homo sapiens) are a species of great ape that originated in Africa about 300,000 years ago. They are distinguished by bipedalism, large brains, language and culture; the world population is about 8 billion.}],
  ['Internet', 'the Internet', q{The Internet is a global network of interconnected computer networks that communicate using TCP/IP. It carries the web, email, streaming and many other services.}],
  ['World Wide Web', 'the Web', q{The World Wide Web is a system of hyperlinked documents and applications accessed over the Internet. Tim Berners-Lee invented it at CERN in 1989 using HTTP, HTML and URLs.}],
  ['Computer', 'computers', q{A computer is a programmable machine that stores and processes data. Modern computers follow the von Neumann design with a processor, memory and input/output devices.}],
  ['Central processing unit', 'CPU', q{The CPU is the part of a computer that executes instructions. It contains an arithmetic logic unit, control unit and registers, and its clock speed is measured in gigahertz.}],
  ['Algorithm', 'algorithms', q{An algorithm is a finite sequence of well-defined steps for solving a problem. Algorithms are judged by correctness and by time and memory complexity.}],
  ['Artificial intelligence', 'AI', q{Artificial intelligence is the field of building machines that perform tasks requiring intelligence, such as reasoning, language and perception. Today's systems are narrow: they excel at specific tasks but lack general understanding.}],
  ['Machine learning', undef, q{Machine learning is a branch of AI where algorithms learn patterns from data instead of explicit rules. Main types are supervised, unsupervised and reinforcement learning.}],
  ['Neural network', 'neural networks', q{A neural network is a computing model of layers of connected units inspired by the brain. Weights are adjusted by backpropagation during training; deep networks power image, speech and language systems.}],
  ['Cryptography', undef, q{Cryptography secures communication and data using mathematics. It covers encryption, digital signatures and hashing; public-key methods such as RSA and TLS protect most Internet traffic.}],
  ['Blockchain', undef, q{A blockchain is a distributed, append-only ledger of blocks linked by cryptographic hashes. Consensus rules keep copies in sync without a central authority; it underlies Bitcoin and other cryptocurrencies.}],
  ['Bitcoin', undef, q{Bitcoin is the first cryptocurrency, launched in 2009 by the pseudonymous Satoshi Nakamoto. It runs on a decentralised proof-of-work blockchain with a capped supply of 21 million coins.}],
  ['Earthquake', 'earthquakes', q{An earthquake is the shaking of the ground caused by a sudden release of energy in Earth's crust. Most occur at plate boundaries; magnitude measures the energy released.}],
  ['Volcano', 'volcanoes', q{A volcano is an opening in a planet's crust where magma, lava, ash and gases erupt. Most volcanoes lie along plate boundaries, including the Pacific Ring of Fire.}],
  ['Tsunami', 'tsunamis', q{A tsunami is a series of large ocean waves usually triggered by an undersea earthquake, landslide or eruption. Waves can cross oceans and grow very tall in shallow coastal water.}],
  ['Tropical cyclone', 'hurricane', q{A tropical cyclone is a rotating storm system over warm ocean water with strong winds and heavy rain. It is called a hurricane in the Atlantic and a typhoon in the western Pacific.}],
  ['Climate', undef, q{Climate is the long-term pattern of weather in a region, usually averaged over 30 years or more. It is shaped by latitude, oceans, altitude and greenhouse gases.}],
  ['Greenhouse effect', undef, q{The greenhouse effect is the trapping of heat by gases such as carbon dioxide, methane and water vapour. It keeps Earth about 33°C warmer than it would otherwise be, but human emissions are strengthening it.}],
  ['Global warming', 'climate change', q{Global warming is the long-term rise in Earth's average surface temperature, driven mainly by greenhouse gas emissions from burning fossil fuels. It causes climate change, including heatwaves, sea-level rise and extreme weather.}],
  ['Ozone layer', undef, q{The ozone layer is a region of the stratosphere rich in ozone (O₃) that absorbs most of the Sun's harmful ultraviolet radiation. It was damaged by CFCs and is recovering under the Montreal Protocol.}],
  ['Water cycle', undef, q{The water cycle is the continuous movement of water between oceans, atmosphere and land. It involves evaporation, condensation, precipitation, runoff and transpiration.}],
  ['Rain', undef, q{Rain is liquid precipitation from clouds, formed when water droplets grow heavy enough to fall. It is a key part of the water cycle and supplies most fresh water.}],
  ['Snow', undef, q{Snow is precipitation of ice crystals that forms when water vapour freezes in clouds. It falls when temperatures are low enough and accumulates as snow cover.}],
  ['Rainbow', 'rainbows', q{A rainbow is an arc of colours caused by sunlight refracting and reflecting inside water droplets. The colours run from red on the outside to violet on the inside.}],
  ['Lightning', undef, q{Lightning is a sudden electrical discharge between clouds or between a cloud and the ground. The channel can reach about 30,000 K, and the rapid heating of air produces thunder.}],
  ['Tornado', 'tornadoes', q{A tornado is a violently rotating column of air extending from a thunderstorm to the ground. The United States averages more than 1,000 a year, mostly in Tornado Alley.}],
  ['Desert', 'deserts', q{A desert is a region with very little precipitation, usually under 250 mm a year. Deserts can be hot or cold; the Sahara is the largest hot desert.}],
  ['Rainforest', 'rainforests', q{A rainforest is a dense forest with high rainfall and enormous biodiversity. The Amazon is the largest tropical rainforest, and rainforests regulate climate and store carbon.}],
  ['Coral reef', 'coral reefs', q{A coral reef is a structure built by colonies of coral polyps that live with algae. Reefs support about a quarter of marine species but are threatened by warming and bleaching.}],
  ['Ecosystem', 'ecosystems', q{An ecosystem is a community of living organisms interacting with their physical environment. Energy flows from producers to consumers, and nutrients cycle through the system.}],
  ['Weather', undef, q{Weather is the state of the atmosphere at a place and time, including temperature, humidity, wind and precipitation. It changes quickly, unlike climate, which is long-term.}],
  ['Sky', 'the sky', q{The sky appears blue because air molecules scatter shorter blue wavelengths of sunlight more than longer red ones, a process called Rayleigh scattering. At sunset the light travels farther, so reds and oranges dominate.}],
  ['Vaccine', 'vaccines', q{A vaccine trains the immune system to recognise a pathogen without causing the disease. It usually contains weakened or inactivated germs or their proteins and creates immunological memory.}],
  ['Antibiotic', 'antibiotics', q{An antibiotic is a medicine that kills or stops the growth of bacteria. It does not work against viruses, and overuse promotes antibiotic resistance.}],
  ['Cancer', undef, q{Cancer is a group of diseases in which cells grow uncontrollably and can spread. It is caused by genetic damage from factors such as smoking, radiation and infections, plus inherited risk.}],
  ['Diabetes', undef, q{Diabetes is a chronic condition in which blood glucose is too high because the body does not make or use insulin properly. Type 1 is autoimmune; type 2 is linked to lifestyle and genetics.}],
  ['Influenza', 'flu', q{Influenza is a contagious respiratory illness caused by influenza viruses. Symptoms include fever, cough and fatigue; annual vaccines reduce risk.}],
  ['COVID-19', undef, q{COVID-19 is the disease caused by the SARS-CoV-2 coronavirus, first identified in 2019. It spreads mainly through respiratory droplets and aerosols and caused a global pandemic.}],
  ['Sleep', undef, q{Sleep is a reversible state of reduced consciousness that restores the body and brain. Adults generally need 7–9 hours; sleep supports memory, immunity and mood.}],
  ['Dream', 'dreams', q{Dreams are images, thoughts and emotions experienced during sleep, mostly in REM sleep. Their function is debated; they may help memory consolidation and emotional processing.}],
  ['Memory', undef, q{Memory is the process of encoding, storing and retrieving information. It includes short-term and long-term systems, and sleep and repetition aid consolidation.}],
  ['Serendipity', undef, q{Serendipity is the occurrence of a happy or useful discovery by chance. The word was coined by Horace Walpole in 1754, inspired by a Persian fairy tale.}],
  ['Coffee', undef, q{Coffee is a brewed drink made from roasted coffee beans, the seeds of Coffea plants. It contains caffeine, a stimulant, and is one of the world's most traded commodities.}],
  ['Tea', undef, q{Tea is a drink made by steeping the leaves of Camellia sinensis in hot water. It originated in China and contains caffeine and antioxidants.}],
  ['Chocolate', undef, q{Chocolate is made from cocoa beans, which are fermented, roasted and ground. It originated in Mesoamerica, where cacao was used in drinks, and contains theobromine and caffeine.}],
  ['Telescope', 'telescopes', q{A telescope collects light to observe distant objects. Refracting telescopes use lenses and reflecting telescopes use mirrors; Galileo's telescope revolutionised astronomy in 1609.}],
  ['Microscope', 'microscopes', q{A microscope magnifies small objects. Optical microscopes use lenses and visible light, while electron microscopes use electron beams to resolve much finer detail.}],
  ['Photography', undef, q{Photography is the art of recording light on a sensor or film. The first permanent photograph was made in 1826; digital cameras now dominate.}],
  ['Music', undef, q{Music is an art form that organises sound in time using pitch, rhythm and timbre. It is found in every known human culture and plays a role in ritual, communication and emotion.}],
  ['Democracy', undef, q{Democracy is a system of government in which power comes from the people, usually through free elections. It rests on rule of law, protected rights and peaceful transfer of power.}],
  ['United Nations', 'UN', q{The United Nations is an international organisation founded in 1945 to maintain peace and security and promote cooperation. It has 193 member states and works through bodies such as the Security Council and General Assembly.}],
  ['European Union', 'EU', q{The European Union is a political and economic union of 27 member states, mostly in Europe. It created a single market and common policies, and was established by the Maastricht Treaty in 1993.}],
  ['World War II', 'WWII', q{World War II was a global conflict from 1939 to 1945 between the Allies and the Axis powers. It involved the Holocaust and the only use of nuclear weapons in war, and ended with the defeat of Germany and Japan.}],
  ['Cold War', 'the Cold War', q{The Cold War was a period of geopolitical tension between the United States and the Soviet Union from about 1947 to 1991. It featured an arms race, proxy wars and the threat of nuclear conflict, and ended with the Soviet collapse.}],
  ['Renaissance', 'the Renaissance', q{The Renaissance was a period of cultural and intellectual revival in Europe from the 14th to the 17th century. It renewed interest in classical learning and produced major advances in art and science.}],
  ['Industrial Revolution', 'the Industrial Revolution', q{The Industrial Revolution began in Britain around 1760 and spread worldwide. It replaced hand production with machines, steam power and factories, transforming economies and society.}],
  ['Telephone', undef, q{The telephone transmits sound over distances using electrical signals. Alexander Graham Bell patented a practical version in 1876; mobile phones now carry most calls.}],
  ['Television', 'TV', q{Television is a medium that transmits moving images and sound. It developed in the early 20th century and became a dominant mass medium after World War II.}],
  ['Radio', undef, q{Radio uses electromagnetic waves to transmit sound and data. Guglielmo Marconi pioneered practical radio in the 1890s, and it remains important for broadcasting and communication.}],
  ['Airplane', 'aeroplane', q{An airplane is a powered flying vehicle with fixed wings. The Wright brothers made the first controlled powered flight in 1903, and jet engines transformed travel after the 1950s.}],
  ['Car', 'automobile', q{A car is a road vehicle powered by an engine or motor. Karl Benz built the first practical automobile in 1886, and the Ford Model T brought motoring to the masses.}],
  ['Train', 'railway', q{A train is a connected series of rail vehicles that carries passengers or freight. Steam locomotives appeared in the early 19th century, followed by diesel and electric trains.}],
  ['Language', 'languages', q{Language is a system of communication using symbols, sounds and grammar. About 7,000 languages are spoken today, and each one shapes how its speakers think and interact.}],
  ['Writing', undef, q{Writing is the recording of language using symbols. It was invented independently in Mesopotamia around 3200 BCE and later in China and Mesoamerica, enabling records and literature.}]
);
for my $c (@curated) {
  my ($title, $alias, $answer) = @$c;
  my $short = $title;
  $short =~ s/ \(.+//;
  add([$title, defined $alias ? $alias : (), $short], $answer, wurl($title));
}

my $pack = { v => 1, e => \@entries };
open my $fh, '>:raw', $out or die "cannot write $out: $!";
print $fh $JSON->encode($pack);
close $fh;
printf "wrote %s: %d entries, %d KB\n", $out, scalar(@entries), (-s $out) / 1024;
